import { minimatch } from "minimatch";

/** Diff analysis and bounded prompt preparation. Token counts are estimates, not billing figures. */
export interface FileDiff {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  patch?: string;
}

export interface DiffCoverage {
  complete: boolean;
  totalFiles: number;
  reviewedFiles: number;
  omittedFiles: string[];
  truncatedFiles: string[];
}

export interface AnalyzedDiff {
  summary: string;
  files: FileDiff[];
  totalAdditions: number;
  totalDeletions: number;
  compressedDiff: string;
  coverage?: DiffCoverage;
}

export interface AnalyzeDiffOptions {
  /** Estimated token budget for the entire prepared diff. Default: 30,000. */
  maxTotalTokens?: number;
  /** Estimated token budget for one file's prepared diff. Default: 2,500. */
  maxTokensPerFile?: number;
  /** Preserve unchanged context when possible. Default: true (changed lines only). */
  compress?: boolean;
}

const DEFAULT_TOTAL_TOKENS = 30_000;
const DEFAULT_FILE_TOKENS = 2_500;

/** Conservative UTF-8 estimate for prompt bounding, not precise provider billing. */
export function estimateTokenCount(text: string): number {
  return Math.ceil(Buffer.byteLength(text, "utf8") / 3);
}

function relevantLines(patch: string, compress: boolean): string[] {
  const lines = patch.split("\n");
  return compress
    ? lines.filter(
        (line) =>
          line.startsWith("+") || line.startsWith("-") || line.startsWith("@@"),
      )
    : lines;
}

function patchAppearsTruncated(file: FileDiff): boolean {
  if (!file.patch) return false;
  let additions = 0;
  let deletions = 0;
  let insideHunk = false;
  for (const line of file.patch.split("\n")) {
    if (line.startsWith("@@")) {
      insideHunk = true;
      continue;
    }
    if (line.startsWith("+") && (insideHunk || !line.startsWith("+++"))) additions += 1;
    if (line.startsWith("-") && (insideHunk || !line.startsWith("---"))) deletions += 1;
  }
  return additions < file.additions || deletions < file.deletions;
}

interface BoundedText {
  text: string;
  truncated: boolean;
  hasContent: boolean;
}

function fitLines(lines: string[], maxTokens: number): BoundedText {
  const full = lines.join("\n");
  if (estimateTokenCount(full) <= maxTokens) {
    return { text: full, truncated: false, hasContent: lines.length > 0 };
  }

  const marker = "[... diff truncated by estimated token budget ...]";
  if (estimateTokenCount(marker) > maxTokens) {
    return { text: "", truncated: true, hasContent: false };
  }
  const selected: number[] = [];
  let left = 0;
  let right = lines.length - 1;

  // Select by index so repeated source lines at distinct positions are never deduplicated.
  while (left <= right) {
    const candidates = left === right ? [left] : [left, right];
    let added = false;
    for (const index of candidates) {
      const next = [...selected, index]
        .sort((a, b) => a - b)
        .map((lineIndex) => lines[lineIndex]);
      if (estimateTokenCount([...next, marker].join("\n")) <= maxTokens) {
        selected.push(index);
        added = true;
      }
    }
    if (!added) break;
    left += 1;
    right -= 1;
  }

  const ordered = [...new Set(selected)]
    .sort((a, b) => a - b)
    .map((index) => lines[index]);
  return {
    text: [...ordered, marker].join("\n"),
    truncated: true,
    hasContent: ordered.length > 0,
  };
}

function buildPreparedDiff(
  files: FileDiff[],
  maxTotalTokens: number,
  maxTokensPerFile: number,
  compress: boolean,
): { text: string; coverage: DiffCoverage } {
  const chunks: string[] = [];
  const omittedFiles: string[] = [];
  const truncatedFiles: string[] = [];
  let usedTokens = 0;
  let reviewedFiles = 0;

  for (const file of files) {
    if (!file.patch) {
      omittedFiles.push(file.filename);
      continue;
    }
    const header = `### ${file.filename}`;
    const separatorTokens = chunks.length === 0 ? 0 : estimateTokenCount("\n\n");
    const remaining = maxTotalTokens - usedTokens - separatorTokens;
    const permitted = Math.min(maxTokensPerFile, remaining);
    if (permitted <= estimateTokenCount(header)) {
      truncatedFiles.push(file.filename);
      continue;
    }

    const bodyBudget = permitted - estimateTokenCount(`${header}\n`);
    const bounded = fitLines(relevantLines(file.patch, compress), bodyBudget);
    if (bounded.hasContent) reviewedFiles += 1;
    const chunk = `${header}\n${bounded.text}`;
    const actual = fitLines(chunk.split("\n"), permitted);
    chunks.push(actual.text);
    usedTokens += separatorTokens + estimateTokenCount(actual.text);
    if (bounded.truncated || actual.truncated || patchAppearsTruncated(file)) {
      truncatedFiles.push(file.filename);
    }
  }

  return {
    text: chunks.join("\n\n"),
    coverage: {
      complete: omittedFiles.length === 0 && truncatedFiles.length === 0,
      totalFiles: files.length,
      reviewedFiles,
      omittedFiles,
      truncatedFiles,
    },
  };
}

/** Convert a PR's file list into one already-bounded diff for every downstream review step. */
export function analyzeDiff(
  files: FileDiff[],
  options: AnalyzeDiffOptions = {},
): AnalyzedDiff {
  const maxTotalTokens = options.maxTotalTokens ?? DEFAULT_TOTAL_TOKENS;
  const maxTokensPerFile = options.maxTokensPerFile ?? DEFAULT_FILE_TOKENS;
  const compress = options.compress ?? true;
  const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const summary = files
    .map((file) => `- ${file.filename} (${file.status}: +${file.additions}/-${file.deletions})`)
    .join("\n");
  const prepared = buildPreparedDiff(files, maxTotalTokens, maxTokensPerFile, compress);

  return {
    summary,
    files,
    totalAdditions,
    totalDeletions,
    compressedDiff: prepared.text,
    coverage: prepared.coverage,
  };
}

export function filterIgnoredFiles(files: FileDiff[], ignorePatterns?: string[]): FileDiff[] {
  if (!ignorePatterns?.length) return files;
  return files.filter((file) => !ignorePatterns.some((pattern) => matchGlobPattern(file.filename, pattern)));
}

function matchGlobPattern(filename: string, pattern: string): boolean {
  const normalizedFilename = filename.replace(/\\/g, "/").trim();
  const normalizedPattern = pattern.replace(/\\/g, "/").trim();
  if (!normalizedPattern) return false;
  const glob = normalizedPattern.endsWith("/")
    ? `**/${normalizedPattern.replace(/^\/+|\/+$/g, "")}/**`
    : normalizedPattern;
  if (!/[*?[\]{}()!+@]/.test(glob)) {
    return normalizedFilename.toLowerCase().includes(glob.toLowerCase());
  }
  return minimatch(normalizedFilename, glob, { nocase: true, dot: true, matchBase: true });
}

export function needsCompression(analyzedDiff: AnalyzedDiff): boolean {
  return estimateTokenCount(analyzedDiff.compressedDiff) > 10_000 || analyzedDiff.files.some((file) => file.additions + file.deletions > 300);
}

export function getTotalChangedLines(analyzedDiff: AnalyzedDiff): number {
  return analyzedDiff.totalAdditions + analyzedDiff.totalDeletions;
}

/** Public compatibility helper. It enforces the supplied per-file estimated token budget. */
export function smartCompressDiff(files: FileDiff[], maxTokensPerFile = DEFAULT_FILE_TOKENS): string {
  return buildPreparedDiff(files, Number.MAX_SAFE_INTEGER, maxTokensPerFile, true).text;
}

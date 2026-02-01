/**
 * Diff Analyzer
 * PR의 변경사항을 분석하고 토큰 최적화를 위해 압축
 */

export interface FileDiff {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  patch?: string;
}

export interface AnalyzedDiff {
  summary: string;
  files: FileDiff[];
  totalAdditions: number;
  totalDeletions: number;
  compressedDiff: string;
}

/**
 * PR Diff를 분석 가능한 형태로 변환
 */
export function analyzeDiff(files: FileDiff[]): AnalyzedDiff {
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  // 파일별 요약 생성
  const summary = files
    .map(
      (f) => `- ${f.filename} (${f.status}: +${f.additions}/-${f.deletions})`,
    )
    .join("\n");

  // 압축된 diff 생성 (핵심 변경사항만)
  const compressedDiff = compressDiff(files);

  return {
    summary,
    files,
    totalAdditions,
    totalDeletions,
    compressedDiff,
  };
}

/**
 * Diff 압축 - 토큰 최적화
 */
function compressDiff(files: FileDiff[]): string {
  const chunks: string[] = [];

  for (const file of files) {
    if (!file.patch) continue;

    // 파일 헤더
    chunks.push(`\n### ${file.filename}\n`);

    // 변경된 라인만 추출 (컨텍스트 최소화)
    const lines = file.patch.split("\n");
    const relevantLines = lines.filter((line) => {
      // 변경된 라인 또는 hunk 헤더만 포함
      return (
        line.startsWith("+") || line.startsWith("-") || line.startsWith("@@")
      );
    });

    chunks.push(relevantLines.join("\n"));
  }

  return chunks.join("\n");
}

/**
 * 파일 패턴 필터링
 */
export function filterIgnoredFiles(
  files: FileDiff[],
  ignorePatterns?: string[],
): FileDiff[] {
  if (!ignorePatterns || ignorePatterns.length === 0) {
    return files;
  }

  return files.filter((file) => {
    for (const pattern of ignorePatterns) {
      // 간단한 glob 패턴 매칭
      if (matchGlobPattern(file.filename, pattern)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * 간단한 glob 패턴 매칭
 */
function matchGlobPattern(filename: string, pattern: string): boolean {
  // *.extension 패턴
  if (pattern.startsWith("*.")) {
    const ext = pattern.slice(1);
    return filename.endsWith(ext);
  }

  // **/path/** 패턴
  if (pattern.includes("**")) {
    const parts = pattern.split("**");
    return parts.every((part) => filename.includes(part.replace(/\//g, "")));
  }

  // 정확한 매칭
  return filename === pattern || filename.includes(pattern);
}

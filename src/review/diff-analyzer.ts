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

/**
 * 토큰 수 추정 (대략 문자 수 / 4)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * 압축 필요 여부 판단
 * - 총 토큰 10,000개 초과 OR
 * - 단일 파일 300줄 이상
 */
export function needsCompression(analyzedDiff: AnalyzedDiff): boolean {
  const totalTokens = estimateTokenCount(analyzedDiff.compressedDiff);
  const hasLargeFile = analyzedDiff.files.some(
    (f) => f.additions + f.deletions > 300,
  );

  return totalTokens > 10000 || hasLargeFile;
}

/**
 * 총 변경된 줄 수 계산 (계층적 리뷰용)
 */
export function getTotalChangedLines(analyzedDiff: AnalyzedDiff): number {
  return analyzedDiff.totalAdditions + analyzedDiff.totalDeletions;
}

/**
 * 스마트 압축 - 대형 PR용
 * 변경된 함수/클래스 위주로 컨텍스트 축소
 */
export function smartCompressDiff(
  files: FileDiff[],
  maxTokensPerFile: number = 2500,
): string {
  const chunks: string[] = [];

  for (const file of files) {
    if (!file.patch) continue;

    chunks.push(`\n### ${file.filename}\n`);

    // 토큰 제한 적용
    const estimatedTokens = estimateTokenCount(file.patch);
    if (estimatedTokens > maxTokensPerFile) {
      // 변경된 라인만 추출 + 앞뒤 5줄 컨텍스트
      const lines = file.patch.split("\n");
      const compressedLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.startsWith("+") ||
          line.startsWith("-") ||
          line.startsWith("@@")
        ) {
          // 변경 라인 + 앞뒤 5줄
          const start = Math.max(0, i - 5);
          const end = Math.min(lines.length, i + 6);
          for (let j = start; j < end; j++) {
            if (!compressedLines.includes(lines[j])) {
              compressedLines.push(lines[j]);
            }
          }
        }
      }
      chunks.push(compressedLines.join("\n"));
      chunks.push(
        `\n[... ${estimatedTokens - maxTokensPerFile} tokens truncated ...]`,
      );
    } else {
      // 기존 압축 방식
      const relevantLines = file.patch
        .split("\n")
        .filter(
          (line) =>
            line.startsWith("+") ||
            line.startsWith("-") ||
            line.startsWith("@@"),
        );
      chunks.push(relevantLines.join("\n"));
    }
  }

  return chunks.join("\n");
}

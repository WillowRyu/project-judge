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
export declare function analyzeDiff(files: FileDiff[]): AnalyzedDiff;
/**
 * 파일 패턴 필터링
 */
export declare function filterIgnoredFiles(files: FileDiff[], ignorePatterns?: string[]): FileDiff[];
/**
 * 토큰 수 추정 (대략 문자 수 / 4)
 */
export declare function estimateTokenCount(text: string): number;
/**
 * 압축 필요 여부 판단
 * - 총 토큰 10,000개 초과 OR
 * - 단일 파일 300줄 이상
 */
export declare function needsCompression(analyzedDiff: AnalyzedDiff): boolean;
/**
 * 총 변경된 줄 수 계산 (계층적 리뷰용)
 */
export declare function getTotalChangedLines(analyzedDiff: AnalyzedDiff): number;
/**
 * 스마트 압축 - 대형 PR용
 * 변경된 함수/클래스 위주로 컨텍스트 축소
 */
export declare function smartCompressDiff(files: FileDiff[], maxTokensPerFile?: number): string;
//# sourceMappingURL=diff-analyzer.d.ts.map
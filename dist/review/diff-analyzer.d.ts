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
//# sourceMappingURL=diff-analyzer.d.ts.map
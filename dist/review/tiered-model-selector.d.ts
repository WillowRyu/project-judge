/**
 * Tiered Model Selector
 * Diff 크기에 따른 적절한 모델 자동 선택
 */
export interface TierConfig {
    small?: string;
    medium?: string;
    large?: string;
}
export interface ModelTier {
    model: string;
    tier: "small" | "medium" | "large";
    useCompression: boolean;
}
/**
 * Diff 크기를 기반으로 tier 결정
 */
export declare function determineTier(totalChangedLines: number): "small" | "medium" | "large";
/**
 * Diff 크기와 모드에 따른 모델 선택
 */
export declare function selectModelForDiff(totalChangedLines: number, mode: "gcp" | "api-key", customConfig?: TierConfig): ModelTier;
/**
 * 모델 계층 정보 로깅용 문자열
 */
export declare function formatTierInfo(modelTier: ModelTier): string;
//# sourceMappingURL=tiered-model-selector.d.ts.map
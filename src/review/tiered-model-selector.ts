/**
 * Tiered Model Selector
 * Diff 크기에 따른 적절한 모델 자동 선택
 */

export interface TierConfig {
  small?: string; // 1-10줄
  medium?: string; // 11-100줄
  large?: string; // 100줄+
}

export interface ModelTier {
  model: string;
  tier: "small" | "medium" | "large";
  useCompression: boolean;
}

// 기본 모델 설정
const DEFAULT_MODELS = {
  gcp: {
    small: "gemini-2.5-flash-lite",
    medium: "gemini-3-flash",
    large: "gemini-3-pro-preview",
  },
  "api-key": {
    small: "gemini-2.5-flash-lite",
    medium: "gemini-2.5-flash",
    large: "gemini-2.5-pro",
  },
} as const;

// 줄 수 기준 (고정값)
const TIER_THRESHOLDS = {
  small: { min: 0, max: 10 },
  medium: { min: 11, max: 100 },
  large: { min: 101, max: Infinity },
} as const;

/**
 * Diff 크기를 기반으로 tier 결정
 */
export function determineTier(
  totalChangedLines: number,
): "small" | "medium" | "large" {
  if (totalChangedLines <= TIER_THRESHOLDS.small.max) {
    return "small";
  }
  if (totalChangedLines <= TIER_THRESHOLDS.medium.max) {
    return "medium";
  }
  return "large";
}

/**
 * Diff 크기와 모드에 따른 모델 선택
 */
export function selectModelForDiff(
  totalChangedLines: number,
  mode: "gcp" | "api-key",
  customConfig?: TierConfig,
): ModelTier {
  const tier = determineTier(totalChangedLines);
  const defaults = DEFAULT_MODELS[mode];

  // 사용자 설정 우선, 없으면 기본값
  const model = customConfig?.[tier] ?? defaults[tier];

  return {
    model,
    tier,
    useCompression: tier === "large",
  };
}

/**
 * 모델 계층 정보 로깅용 문자열
 */
export function formatTierInfo(modelTier: ModelTier): string {
  const tierLabels = {
    small: "소형 (1-10줄)",
    medium: "중형 (11-100줄)",
    large: "대형 (100줄+)",
  };
  return `${tierLabels[modelTier.tier]} → ${modelTier.model}${modelTier.useCompression ? " (압축 적용)" : ""}`;
}

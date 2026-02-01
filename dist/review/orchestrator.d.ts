import { LLMProvider } from "../providers/provider.interface";
import { Persona, ReviewResult } from "../personas/persona.interface";
import { AnalyzedDiff } from "./diff-analyzer";
import { TierConfig } from "./tiered-model-selector";
/**
 * Review Orchestrator
 * 3개 페르소나를 병렬로 실행하여 리뷰 수행
 * - 계층적 리뷰: Diff 크기에 따른 모델 자동 선택
 * - Context Caching: 동일 PR 컨텍스트 재사용
 * - 프롬프트 압축: 대형 PR용 토큰 최적화
 */
export interface PRContext {
    title: string;
    body: string;
    diff: AnalyzedDiff;
    author: string;
    baseBranch: string;
    headBranch: string;
}
export interface ReviewOptions {
    enableCaching?: boolean;
    enableCompression?: boolean;
    tieredModels?: TierConfig;
}
/**
 * 모든 페르소나로 병렬 리뷰 수행 (최적화 적용)
 */
export declare function runReviews(provider: LLMProvider, personas: Persona[], context: PRContext, options?: ReviewOptions): Promise<ReviewResult[]>;
//# sourceMappingURL=orchestrator.d.ts.map
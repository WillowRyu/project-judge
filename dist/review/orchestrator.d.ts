import { LLMProvider } from "../providers/provider.interface";
import { Persona, ReviewResult } from "../personas/persona.interface";
import { AnalyzedDiff } from "./diff-analyzer";
/**
 * Review Orchestrator
 * 3개 페르소나를 병렬로 실행하여 리뷰 수행
 */
export interface PRContext {
    title: string;
    body: string;
    diff: AnalyzedDiff;
    author: string;
    baseBranch: string;
    headBranch: string;
}
/**
 * 모든 페르소나로 병렬 리뷰 수행
 */
export declare function runReviews(provider: LLMProvider, personas: Persona[], context: PRContext): Promise<ReviewResult[]>;
//# sourceMappingURL=orchestrator.d.ts.map
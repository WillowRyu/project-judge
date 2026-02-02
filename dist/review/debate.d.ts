import { LLMProvider } from "../providers/provider.interface";
import { Persona, ReviewResult, VoteResult } from "../personas/persona.interface";
import { PRContext } from "./orchestrator";
/**
 * Debate Module
 * 페르소나들이 의견 충돌 시 토론하는 기능
 */
export interface DebateConfig {
    enabled: boolean;
    maxRounds: number;
    trigger: "conflict" | "disagreement" | "always";
    revoteAfterDebate: boolean;
}
export interface DebateResponse {
    personaId: string;
    personaName: string;
    targetPersonaId: string;
    response: string;
    changedVote?: VoteResult;
    newReason?: string;
}
export interface DebateRoundResult {
    round: number;
    responses: DebateResponse[];
    finalVotes: ReviewResult[];
}
/**
 * 토론이 필요한지 판단
 */
export declare function needsDebate(reviews: ReviewResult[], config?: DebateConfig): boolean;
/**
 * 토론 라운드 실행
 */
export declare function runDebateRound(provider: LLMProvider, personas: Persona[], reviews: ReviewResult[], context: PRContext, round: number): Promise<DebateRoundResult>;
/**
 * 전체 토론 프로세스 실행
 */
export declare function runDebate(provider: LLMProvider, personas: Persona[], reviews: ReviewResult[], context: PRContext, config?: DebateConfig): Promise<ReviewResult[]>;
//# sourceMappingURL=debate.d.ts.map
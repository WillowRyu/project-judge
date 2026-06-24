/**
 * Persona Interface
 * 각 페르소나의 정의 및 리뷰 결과 타입
 */
export interface Persona {
    id: string;
    name: string;
    emoji: string;
    role: string;
    guideline: string;
    model?: string;
    provider?: "gemini" | "openai" | "claude";
}
export type VoteResult = "approve" | "reject" | "conditional";
export interface ReviewResult {
    personaId: string;
    personaName: string;
    personaEmoji: string;
    vote: VoteResult;
    reason: string;
    details: string;
    suggestions?: string[];
    debateResponse?: string;
    originalVote?: VoteResult;
    error?: boolean;
    errorKind?: "rate_limit" | "other";
}
export interface VotingSummary {
    totalVoters: number;
    approvals: number;
    rejections: number;
    conditionals: number;
    errored: number;
    validVoters: number;
    undetermined: boolean;
    passed: boolean;
    requiredApprovals: number;
}
//# sourceMappingURL=persona.interface.d.ts.map
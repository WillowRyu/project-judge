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
}
export interface VotingSummary {
    totalVoters: number;
    approvals: number;
    rejections: number;
    conditionals: number;
    passed: boolean;
    requiredApprovals: number;
}
//# sourceMappingURL=persona.interface.d.ts.map
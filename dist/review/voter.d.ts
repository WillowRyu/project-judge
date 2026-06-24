import { ReviewResult, VotingSummary, VoteResult } from "../personas/persona.interface";
/**
 * Voter
 * 페르소나들의 리뷰 결과를 집계하여 최종 판정
 */
export interface VotingConfig {
    requiredApprovals: number;
    totalVoters: number;
}
export declare function countVotesWithConfig(reviews: ReviewResult[], config: VotingConfig): VotingSummary;
export declare function countVotes(reviews: ReviewResult[]): VotingSummary;
export declare function getVoteResultString(summary: VotingSummary): string;
/**
 * 투표 결과 이모지 변환
 */
export declare function getVoteEmoji(vote: VoteResult): string;
//# sourceMappingURL=voter.d.ts.map
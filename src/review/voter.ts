import {
  ReviewResult,
  VotingSummary,
  VoteResult,
} from "../personas/persona.interface";

/**
 * Voter
 * 페르소나들의 리뷰 결과를 집계하여 최종 판정
 */

export interface VotingConfig {
  requiredApprovals: number;
  totalVoters: number;
}

/**
 * 투표 결과 집계
 */
export function countVotes(reviews: ReviewResult[]): VotingSummary {
  const approvals = reviews.filter((r) => r.vote === "approve").length;
  const rejections = reviews.filter((r) => r.vote === "reject").length;
  const conditionals = reviews.filter((r) => r.vote === "conditional").length;

  // conditional은 0.5표로 계산
  const effectiveApprovals = approvals + conditionals * 0.5;

  return {
    totalVoters: reviews.length,
    approvals,
    rejections,
    conditionals,
    passed: effectiveApprovals >= 2, // 기본: 2표 이상
    requiredApprovals: 2,
  };
}

/**
 * 설정 기반 투표 결과 집계
 */
export function countVotesWithConfig(
  reviews: ReviewResult[],
  config: VotingConfig,
): VotingSummary {
  const approvals = reviews.filter((r) => r.vote === "approve").length;
  const rejections = reviews.filter((r) => r.vote === "reject").length;
  const conditionals = reviews.filter((r) => r.vote === "conditional").length;

  // conditional은 0.5표로 계산
  const effectiveApprovals = approvals + conditionals * 0.5;

  return {
    totalVoters: reviews.length,
    approvals,
    rejections,
    conditionals,
    passed: effectiveApprovals >= config.requiredApprovals,
    requiredApprovals: config.requiredApprovals,
  };
}

/**
 * 최종 결과 문자열 생성
 */
export function getVoteResultString(summary: VotingSummary): string {
  if (summary.passed) {
    return `✅ 승인 (${summary.approvals}${summary.conditionals > 0 ? `+${summary.conditionals}조건부` : ""}/${summary.totalVoters})`;
  }
  return `❌ 거부 (${summary.approvals}/${summary.totalVoters}, ${summary.requiredApprovals}표 필요)`;
}

/**
 * 투표 결과 이모지 변환
 */
export function getVoteEmoji(vote: VoteResult): string {
  switch (vote) {
    case "approve":
      return "✅";
    case "reject":
      return "❌";
    case "conditional":
      return "⚠️";
    default:
      return "❓";
  }
}

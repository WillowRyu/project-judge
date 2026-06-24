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

export function countVotesWithConfig(
  reviews: ReviewResult[],
  config: VotingConfig,
): VotingSummary {
  const valid = reviews.filter((r) => !r.error);
  const approvals = valid.filter((r) => r.vote === "approve").length;
  const rejections = valid.filter((r) => r.vote === "reject").length;
  const conditionals = valid.filter((r) => r.vote === "conditional").length;
  const errored = reviews.length - valid.length;

  // conditional은 0.5표
  const effectiveApprovals = approvals + conditionals * 0.5;
  const validVoters = valid.length;
  const undetermined = validVoters < config.requiredApprovals;
  const passed = !undetermined && effectiveApprovals >= config.requiredApprovals;

  return {
    totalVoters: reviews.length,
    approvals,
    rejections,
    conditionals,
    errored,
    validVoters,
    undetermined,
    passed,
    requiredApprovals: config.requiredApprovals,
  };
}

export function countVotes(reviews: ReviewResult[]): VotingSummary {
  return countVotesWithConfig(reviews, {
    requiredApprovals: 2,
    totalVoters: reviews.length,
  });
}

export function getVoteResultString(summary: VotingSummary): string {
  const errSuffix = summary.errored > 0 ? `, ${summary.errored} 실패` : "";

  if (summary.undetermined) {
    return `⚠️ 판정 불가 (유효 ${summary.validVoters}표, ${summary.requiredApprovals}표 필요${errSuffix})`;
  }
  if (summary.passed) {
    return `✅ 승인 (${summary.approvals}${summary.conditionals > 0 ? `+${summary.conditionals}조건부` : ""}/${summary.validVoters}${errSuffix})`;
  }
  return `❌ 거부 (${summary.approvals}/${summary.validVoters}, ${summary.requiredApprovals}표 필요${errSuffix})`;
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

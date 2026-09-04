import { ReviewResult, VotingSummary } from "../personas/persona.interface";
import { getVoteEmoji } from "../review/voter";

/**
 * Slack Notification Module
 * Slack Webhook을 통한 MAGI Review 결과 알림
 */

export interface SlackNotifyConfig {
  webhookUrl: string;
  notifyOn: "all" | "rejection" | "approval";
  language?: "ko" | "en";
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: Array<{
    type: string;
    text?: { type: string; text: string; emoji?: boolean };
    url?: string;
  }>;
  fields?: Array<{ type: string; text: string }>;
}

interface SlackMessage {
  blocks: SlackBlock[];
}

/**
 * 알림을 보낼지 여부 결정
 */
export function shouldNotify(
  votingSummary: VotingSummary,
  notifyOn: "all" | "rejection" | "approval",
): boolean {
  if (notifyOn === "all") return true;
  if (votingSummary.undetermined || votingSummary.incomplete) return false;
  if (notifyOn === "approval" && votingSummary.passed) return true;
  if (notifyOn === "rejection" && !votingSummary.passed) return true;
  return false;
}

/**
 * 투표 결과를 Slack 형식으로 포맷
 */
function formatVoteForSlack(review: ReviewResult): string {
  if (review.error) {
    return "⚠️";
  }

  const emoji = getVoteEmoji(review.vote);

  if (review.originalVote && review.originalVote !== review.vote) {
    const originalEmoji = getVoteEmoji(review.originalVote);
    return `${originalEmoji} → ${emoji}`;
  }

  return emoji;
}

/**
 * Slack Block Kit 메시지 생성
 */
export function buildSlackMessage(
  prTitle: string,
  prUrl: string,
  prNumber: number,
  reviews: ReviewResult[],
  votingSummary: VotingSummary,
  commentUrl?: string,
  language: "ko" | "en" = "ko",
): SlackMessage {
  const english = language === "en";
  const resultEmoji = votingSummary.undetermined
    ? "⚠️"
    : votingSummary.passed
      ? "✅"
      : "❌";
  const resultText = votingSummary.incomplete
    ? (english ? "Incomplete review" : "검토 범위 불완전")
    : votingSummary.undetermined
      ? (english ? "Undetermined" : "판정 불가")
      : votingSummary.passed
        ? (english ? "Approved" : "승인")
        : (english ? "Rejected" : "거부");

  // 투표 결과 필드 생성
  const voteFields = reviews.map((review) => ({
    type: "mrkdwn" as const,
    text: `${review.personaEmoji} *${review.personaName}*\n${formatVoteForSlack(review)} ${review.error ? (english ? "Review failed" : "리뷰 실패") : review.vote}`,
  }));

  const blocks: SlackBlock[] = [
    // 헤더
    {
      type: "header",
      text: {
        type: "plain_text",
        text: english ? "🏛️ MAGI review results" : "🏛️ MAGI 리뷰 결과",
        emoji: true,
      },
    },
    // PR 정보
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${prUrl}|#${prNumber} ${prTitle}>*`,
      },
    },
    // 결과 요약
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${resultEmoji} *${resultText}* (${votingSummary.approvals}/${votingSummary.validVoters}, ${votingSummary.requiredApprovals}${english ? " required" : "표 필요"}${votingSummary.errored > 0 ? `, ${votingSummary.errored}${english ? " failed" : " 실패"}` : ""})`,
      },
    },
    // 구분선
    {
      type: "divider",
    },
    // 투표 상세
    {
      type: "section",
      fields: voteFields,
    },
  ];

  // 버튼 추가
  const buttons: Array<{
    type: string;
    text: { type: string; text: string; emoji: boolean };
    url: string;
  }> = [
    {
      type: "button",
      text: {
        type: "plain_text",
        text: english ? "📋 View PR" : "📋 PR 보기",
        emoji: true,
      },
      url: prUrl,
    },
  ];

  // 코멘트 URL이 있으면 상세 리뷰 보기 버튼 추가
  if (commentUrl) {
    buttons.push({
      type: "button",
      text: {
        type: "plain_text",
        text: english ? "🔍 View review" : "🔍 상세 리뷰 보기",
        emoji: true,
      },
      url: commentUrl,
    });
  }

  blocks.push({
    type: "actions",
    elements: buttons,
  });

  return { blocks };
}

/**
 * Slack Webhook으로 메시지 전송
 */
export async function sendSlackNotification(
  webhookUrl: string,
  message: SlackMessage,
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Slack notification failed: ${response.status} - ${errorText}`,
    );
  }
}

/**
 * MAGI 리뷰 결과를 Slack으로 알림
 */
export async function notifySlack(
  config: SlackNotifyConfig,
  prTitle: string,
  prUrl: string,
  prNumber: number,
  reviews: ReviewResult[],
  votingSummary: VotingSummary,
  commentUrl?: string,
): Promise<boolean> {
  // 알림 조건 확인
  if (!shouldNotify(votingSummary, config.notifyOn)) {
    console.log(
      `ℹ️ Slack notification skipped (notify_on: ${config.notifyOn})`,
    );
    return false;
  }

  // 메시지 생성
  const message = buildSlackMessage(
    prTitle,
    prUrl,
    prNumber,
    reviews,
    votingSummary,
    commentUrl,
    config.language,
  );

  // 전송
  await sendSlackNotification(config.webhookUrl, message);
  console.log("📨 Slack notification sent!");

  return true;
}

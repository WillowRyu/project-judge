import { ReviewResult, VotingSummary } from "../personas/persona.interface";
import { getVoteEmoji, getVoteResultString } from "../review/voter";

/**
 * Comment Generator
 * PR에 작성할 리뷰 코멘트 마크다운 생성
 */

export interface CommentOptions {
  style: "summary" | "detailed";
  includeActionItems: boolean;
}

/**
 * MAGI 리뷰 결과 코멘트 생성
 */
export function generateComment(
  reviews: ReviewResult[],
  votingSummary: VotingSummary,
  options: CommentOptions = { style: "detailed", includeActionItems: true },
): string {
  const lines: string[] = [];

  // 헤더
  lines.push("## 🏛️ MAGI 시스템 리뷰 결과\n");

  // 최종 결과
  lines.push(`### ${getVoteResultString(votingSummary)}\n`);

  // 투표 테이블
  lines.push("| 페르소나 | 판정 | 핵심 이유 |");
  lines.push("|:-------:|:----:|----------|");

  for (const review of reviews) {
    const emoji = getVoteEmoji(review.vote);
    lines.push(
      `| ${review.personaEmoji} ${review.personaName} | ${emoji} | ${review.reason} |`,
    );
  }
  lines.push("");

  // 개선 제안 섹션 (상단에 배치)
  const allSuggestions = collectSuggestions(reviews);
  if (allSuggestions.length > 0) {
    lines.push("### 💡 개선 제안\n");

    for (const {
      personaEmoji,
      personaName,
      suggestion,
      details,
    } of allSuggestions) {
      lines.push(`<details>`);
      lines.push(
        `<summary><strong>${personaEmoji} ${suggestion}</strong></summary>\n`,
      );
      lines.push(`> **제안자:** ${personaName}\n`);
      if (details) {
        lines.push(details);
      }
      lines.push(`\n</details>\n`);
    }
  }

  // 상세 리뷰 (detailed 모드)
  if (options.style === "detailed") {
    lines.push("---\n");
    lines.push("### 📝 상세 분석\n");

    for (const review of reviews) {
      lines.push(
        `<details>\n<summary>${review.personaEmoji} ${review.personaName} 상세 리뷰</summary>\n`,
      );
      lines.push(
        `#### ${getVoteEmoji(review.vote)} ${review.vote.toUpperCase()}\n`,
      );
      lines.push(`**판정 이유:** ${review.reason}\n`);

      if (review.details) {
        lines.push("**분석 내용:**\n");
        lines.push(review.details);
        lines.push("");
      }

      lines.push("</details>\n");
    }
  }

  // 액션 아이템
  if (options.includeActionItems) {
    const actionItems = extractActionItems(reviews);
    if (actionItems.length > 0) {
      lines.push("### 📋 액션 아이템\n");
      for (const item of actionItems) {
        lines.push(`- [ ] ${item}`);
      }
      lines.push("");
    }
  }

  // 푸터
  lines.push("---");
  lines.push(
    "*이 리뷰는 [MAGI Review](https://github.com/your-org/magi-review) 시스템에 의해 자동 생성되었습니다.*",
  );

  return lines.join("\n");
}

interface SuggestionItem {
  personaEmoji: string;
  personaName: string;
  suggestion: string;
  details?: string;
}

/**
 * 모든 페르소나의 개선 제안 수집
 */
function collectSuggestions(reviews: ReviewResult[]): SuggestionItem[] {
  const items: SuggestionItem[] = [];

  for (const review of reviews) {
    if (review.suggestions && review.suggestions.length > 0) {
      for (const suggestion of review.suggestions) {
        items.push({
          personaEmoji: review.personaEmoji,
          personaName: review.personaName,
          suggestion,
          details: review.details,
        });
      }
    }
  }

  return items;
}

/**
 * 리뷰에서 액션 아이템 추출
 */
function extractActionItems(reviews: ReviewResult[]): string[] {
  const items: string[] = [];

  for (const review of reviews) {
    if (review.vote === "reject" || review.vote === "conditional") {
      if (review.suggestions) {
        items.push(...review.suggestions);
      }
    }
  }

  // 중복 제거
  return [...new Set(items)];
}

/**
 * 업데이트용 코멘트 마커 생성
 */
export function getCommentMarker(): string {
  return "<!-- magi-review-comment -->";
}

/**
 * 마커가 포함된 코멘트 생성
 */
export function generateCommentWithMarker(
  reviews: ReviewResult[],
  votingSummary: VotingSummary,
  options?: CommentOptions,
): string {
  return `${getCommentMarker()}\n${generateComment(reviews, votingSummary, options)}`;
}

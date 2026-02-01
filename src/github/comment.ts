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

  // ========================================
  // 상세 분석 섹션
  // ========================================
  if (options.style === "detailed") {
    lines.push("---");
    lines.push("## 📝 상세 분석\n");

    for (const review of reviews) {
      lines.push(`<details>`);
      lines.push(
        `<summary><strong>${review.personaEmoji} ${review.personaName}</strong> (${getVoteEmoji(review.vote)} ${review.vote})</summary>`,
      );
      lines.push(""); // 빈 줄 추가로 가독성 향상
      lines.push("<br>\n"); // 추가 간격

      if (review.details) {
        lines.push(review.details);
      }

      lines.push("\n</details>\n");
    }
  }

  // ========================================
  // 개선 제안 섹션 (페르소나별 그룹화 + 이유 포함)
  // ========================================
  const suggestionsByPersona = groupSuggestionsByPersona(reviews);
  if (suggestionsByPersona.length > 0) {
    lines.push("---");
    lines.push("## 💡 개선 제안\n");

    for (const {
      personaEmoji,
      personaName,
      suggestions,
      reason,
    } of suggestionsByPersona) {
      lines.push(`<details>`);
      lines.push(
        `<summary><strong>${personaEmoji} ${personaName}</strong> (${suggestions.length}개 제안)</summary>`,
      );
      lines.push(""); // 빈 줄 추가
      lines.push("<br>\n"); // 추가 간격

      // 판정 이유 포함
      if (reason) {
        lines.push(`> 💬 **판정 이유:** ${reason}\n`);
      }

      // 테이블 형식으로 제안 표시
      lines.push("| # | 제안 내용 |");
      lines.push("|---|----------|");
      for (let i = 0; i < suggestions.length; i++) {
        lines.push(`| ${i + 1} | ${suggestions[i]} |`);
      }

      lines.push("\n</details>\n");
    }
  }

  // ========================================
  // 액션 아이템 (체크리스트)
  // ========================================
  if (options.includeActionItems) {
    const actionItems = extractActionItems(reviews);
    if (actionItems.length > 0) {
      lines.push("---");
      lines.push("## 📋 액션 아이템\n");
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

interface PersonaSuggestions {
  personaEmoji: string;
  personaName: string;
  suggestions: string[];
  reason: string;
}

/**
 * 페르소나별로 제안 그룹화
 */
function groupSuggestionsByPersona(
  reviews: ReviewResult[],
): PersonaSuggestions[] {
  const result: PersonaSuggestions[] = [];

  for (const review of reviews) {
    if (review.suggestions && review.suggestions.length > 0) {
      result.push({
        personaEmoji: review.personaEmoji,
        personaName: review.personaName,
        suggestions: review.suggestions,
        reason: review.reason,
      });
    }
  }

  return result;
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

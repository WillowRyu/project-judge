import { ReviewResult, VotingSummary } from "../personas/persona.interface";
import { getVoteEmoji, getVoteResultString } from "../review/voter";

/**
 * 투표 결과 표시 (변경된 경우 before→after 형식)
 */
function formatVoteDisplay(review: ReviewResult): string {
  const currentEmoji = getVoteEmoji(review.vote);

  if (review.originalVote && review.originalVote !== review.vote) {
    const originalEmoji = getVoteEmoji(review.originalVote);
    return `${originalEmoji} ${review.originalVote} → ${currentEmoji} ${review.vote}`;
  }

  return `${currentEmoji} ${review.vote}`;
}

/**
 * Comment Generator
 * PR에 작성할 리뷰 코멘트 마크다운 생성
 */

/**
 * LLM 응답의 details를 마크다운으로 포맷팅
 * JSON 형태로 반환된 경우 읽기 쉬운 형태로 변환
 */
function formatReviewDetails(details: string): string {
  // 이미 마크다운 형식이면 그대로 반환
  if (!details.trim().startsWith("{") && !details.trim().startsWith("[")) {
    return details;
  }

  // JSON 형식인 경우 파싱 시도
  try {
    const parsed = JSON.parse(details);

    // 객체를 마크다운으로 변환
    return formatObjectAsMarkdown(parsed);
  } catch {
    // 파싱 실패 시 코드 블록으로 감싸서 표시
    return `\`\`\`json\n${details}\n\`\`\``;
  }
}

/**
 * 객체를 마크다운으로 변환
 */
function formatObjectAsMarkdown(
  obj: Record<string, unknown>,
  depth = 0,
): string {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(`${indent}**${key}:**`);
      for (const item of value) {
        if (typeof item === "string") {
          lines.push(`${indent}- ${item}`);
        } else if (typeof item === "object" && item !== null) {
          lines.push(
            formatObjectAsMarkdown(item as Record<string, unknown>, depth + 1),
          );
        }
      }
    } else if (typeof value === "object" && value !== null) {
      lines.push(`${indent}**${key}:**`);
      lines.push(
        formatObjectAsMarkdown(value as Record<string, unknown>, depth + 1),
      );
    } else {
      lines.push(`${indent}**${key}:** ${value}`);
    }
  }

  return lines.join("\n");
}

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
    const voteDisplay = formatVoteDisplay(review);
    lines.push(
      `| ${review.personaEmoji} ${review.personaName} | ${voteDisplay} | ${review.reason} |`,
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
      const voteDisplay = formatVoteDisplay(review);
      lines.push(`<details>`);
      lines.push(
        `<summary><strong>${review.personaEmoji} ${review.personaName}</strong> (${voteDisplay})</summary>`,
      );
      lines.push(""); // 빈 줄 추가로 가독성 향상
      lines.push("<br>\n"); // 추가 간격

      // 코드 리뷰 내용 (details가 JSON이면 포맷팅)
      if (review.details) {
        const formattedDetails = formatReviewDetails(review.details);
        lines.push(`### 🔍 코드 리뷰: ${review.personaName}\n`);
        lines.push(formattedDetails);
      }

      // 토론 응답이 있으면 표시
      if (review.debateResponse) {
        lines.push("\n---\n");
        lines.push(`### 🗣️ 토론 의견\n`);
        lines.push(`> ${review.debateResponse}\n`);
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

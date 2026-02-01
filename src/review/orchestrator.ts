import { LLMProvider } from "../providers/provider.interface";
import {
  Persona,
  ReviewResult,
  VoteResult,
} from "../personas/persona.interface";
import { AnalyzedDiff } from "./diff-analyzer";

/**
 * Review Orchestrator
 * 3개 페르소나를 병렬로 실행하여 리뷰 수행
 */

export interface PRContext {
  title: string;
  body: string;
  diff: AnalyzedDiff;
  author: string;
  baseBranch: string;
  headBranch: string;
}

/**
 * 단일 페르소나로 리뷰 수행
 */
async function reviewWithPersona(
  provider: LLMProvider,
  persona: Persona,
  context: PRContext,
): Promise<ReviewResult> {
  const prompt = buildPrompt(persona, context);

  try {
    let response: string;

    // 페르소나별 모델이 지정된 경우 reviewWithModel 사용
    if (persona.model && provider.reviewWithModel) {
      console.log(`    Using model: ${persona.model}`);
      response = await provider.reviewWithModel(prompt, persona.model);
    } else {
      response = await provider.review(prompt);
    }

    return parseReviewResponse(persona, response);
  } catch (error) {
    console.error(`Error reviewing with ${persona.name}:`, error);
    // 에러 발생 시 기본 응답
    return {
      personaId: persona.id,
      personaName: persona.name,
      personaEmoji: persona.emoji,
      vote: "conditional",
      reason: "리뷰 실행 중 오류 발생",
      details: `리뷰를 수행하는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
      suggestions: [],
    };
  }
}

/**
 * 프롬프트 생성
 */
function buildPrompt(persona: Persona, context: PRContext): string {
  return `${persona.guideline}

---

## 리뷰 대상 Pull Request

**제목**: ${context.title}
**작성자**: ${context.author}
**브랜치**: ${context.headBranch} → ${context.baseBranch}

### PR 설명
${context.body || "(설명 없음)"}

### 변경 파일 요약
${context.diff.summary}

총 변경: +${context.diff.totalAdditions}/-${context.diff.totalDeletions}

### 변경 내용 (Diff)
\`\`\`diff
${context.diff.compressedDiff}
\`\`\`

---

위 지침에 따라 이 PR을 리뷰해주세요.
반드시 지정된 JSON 형식으로만 응답해주세요.
`;
}

/**
 * LLM 응답 파싱
 */
function parseReviewResponse(persona: Persona, response: string): ReviewResult {
  try {
    // JSON 블록 추출
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;

    // JSON 파싱 시도
    const parsed = JSON.parse(jsonStr.trim());

    return {
      personaId: persona.id,
      personaName: persona.name,
      personaEmoji: persona.emoji,
      vote: validateVote(parsed.vote),
      reason: parsed.reason || "이유 없음",
      details: parsed.details || "",
      suggestions: parsed.suggestions || [],
    };
  } catch {
    // 파싱 실패 시 텍스트에서 추론
    const vote = inferVoteFromText(response);
    return {
      personaId: persona.id,
      personaName: persona.name,
      personaEmoji: persona.emoji,
      vote,
      reason: "응답 파싱 실패",
      details: response.slice(0, 1000), // 처음 1000자만
      suggestions: [],
    };
  }
}

/**
 * 투표 값 검증
 */
function validateVote(vote: unknown): VoteResult {
  if (vote === "approve" || vote === "reject" || vote === "conditional") {
    return vote;
  }
  return "conditional";
}

/**
 * 텍스트에서 투표 추론
 */
function inferVoteFromText(text: string): VoteResult {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("approve") || lowerText.includes("승인")) {
    return "approve";
  }
  if (lowerText.includes("reject") || lowerText.includes("거부")) {
    return "reject";
  }
  return "conditional";
}

/**
 * 모든 페르소나로 병렬 리뷰 수행
 */
export async function runReviews(
  provider: LLMProvider,
  personas: Persona[],
  context: PRContext,
): Promise<ReviewResult[]> {
  console.log(`Starting parallel reviews with ${personas.length} personas...`);

  const reviews = await Promise.all(
    personas.map((persona) => {
      console.log(`  - ${persona.emoji} ${persona.name} reviewing...`);
      return reviewWithPersona(provider, persona, context);
    }),
  );

  console.log("All reviews completed.");
  return reviews;
}

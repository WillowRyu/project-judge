import { LLMProvider } from "../providers/provider.interface";
import {
  Persona,
  ReviewResult,
  VoteResult,
} from "../personas/persona.interface";
import { PRContext } from "./orchestrator";

/**
 * Debate Module
 * 페르소나들이 의견 충돌 시 토론하는 기능
 */

export interface DebateConfig {
  enabled: boolean;
  maxRounds: number;
  trigger: "conflict" | "disagreement" | "always";
  revoteAfterDebate: boolean;
}

export interface DebateResponse {
  personaId: string;
  personaName: string;
  targetPersonaId: string;
  response: string;
  changedVote?: VoteResult;
  newReason?: string;
}

export interface DebateRoundResult {
  round: number;
  responses: DebateResponse[];
  finalVotes: ReviewResult[];
}

const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  enabled: false,
  maxRounds: 1,
  trigger: "disagreement",
  revoteAfterDebate: true,
};

/**
 * 토론이 필요한지 판단
 */
export function needsDebate(
  reviews: ReviewResult[],
  config: DebateConfig = DEFAULT_DEBATE_CONFIG,
): boolean {
  if (!config.enabled) return false;
  if (config.trigger === "always") return true;

  const hasApproval = reviews.some((r) => r.vote === "approve");
  const hasRejection = reviews.some((r) => r.vote === "reject");

  if (config.trigger === "conflict") {
    // approve와 reject가 모두 있을 때만 토론
    return hasApproval && hasRejection;
  }

  if (config.trigger === "disagreement") {
    // 만장일치가 아닐 때 토론
    const firstVote = reviews[0]?.vote;
    return reviews.some((r) => r.vote !== firstVote);
  }

  return false;
}

/**
 * 토론 프롬프트 생성
 */
function buildDebatePrompt(
  persona: Persona,
  otherReviews: ReviewResult[],
  context: PRContext,
): string {
  const otherOpinions = otherReviews
    .map(
      (r) => `### ${r.personaEmoji} ${r.personaName}의 의견
- **투표**: ${r.vote}
- **이유**: ${r.reason}
- **상세**: ${r.details}`,
    )
    .join("\n\n");

  return `당신은 ${persona.name}입니다. ${persona.role} 관점에서 코드를 리뷰합니다.

## 현재 상황
"${context.title}" PR에 대해 다른 페르소나들이 다음과 같이 투표했습니다:

${otherOpinions}

## 당신의 원래 입장을 고려하여:
1. 다른 페르소나들의 의견에 동의하거나 반박해주세요
2. 새로운 관점이나 놓친 부분이 있다면 제시해주세요
3. 최종적으로 당신의 입장을 유지할지, 변경할지 결정해주세요

다음 JSON 형식으로 응답해주세요:
\`\`\`json
{
  "response": "다른 페르소나 의견에 대한 반박 또는 동의 내용",
  "changedVote": "approve | reject | conditional | null (변경 없으면 null)",
  "newReason": "투표 변경 시 새로운 이유 (변경 없으면 null)"
}
\`\`\``;
}

/**
 * 토론 응답 파싱
 */
function parseDebateResponse(
  persona: Persona,
  targetPersona: ReviewResult,
  response: string,
): DebateResponse {
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;
    const parsed = JSON.parse(jsonStr.trim());

    return {
      personaId: persona.id,
      personaName: persona.name,
      targetPersonaId: targetPersona.personaId,
      response: parsed.response || "",
      changedVote: parsed.changedVote || undefined,
      newReason: parsed.newReason || undefined,
    };
  } catch {
    return {
      personaId: persona.id,
      personaName: persona.name,
      targetPersonaId: targetPersona.personaId,
      response: response.slice(0, 500),
    };
  }
}

/**
 * 토론 라운드 실행
 */
export async function runDebateRound(
  provider: LLMProvider,
  personas: Persona[],
  reviews: ReviewResult[],
  context: PRContext,
  round: number,
): Promise<DebateRoundResult> {
  console.log(`\n🗣️ Debate Round ${round} starting...`);

  const responses: DebateResponse[] = [];

  // 각 페르소나가 다른 의견을 가진 페르소나에 대해 토론
  for (const persona of personas) {
    const myReview = reviews.find((r) => r.personaId === persona.id);
    const otherReviews = reviews.filter(
      (r) => r.personaId !== persona.id && r.vote !== myReview?.vote,
    );

    if (otherReviews.length === 0) {
      console.log(
        `  ${persona.emoji} ${persona.name}: No disagreements to address`,
      );
      continue;
    }

    console.log(
      `  ${persona.emoji} ${persona.name}: Responding to ${otherReviews.length} different opinions...`,
    );

    const prompt = buildDebatePrompt(persona, otherReviews, context);
    const response = await provider.review(prompt);

    const debateResponse = parseDebateResponse(
      persona,
      otherReviews[0],
      response,
    );
    responses.push(debateResponse);

    if (debateResponse.changedVote) {
      console.log(`    → Changed vote to: ${debateResponse.changedVote}`);
    }
  }

  // 최종 투표 결과 업데이트
  const finalVotes = reviews.map((review) => {
    const debateResp = responses.find((r) => r.personaId === review.personaId);
    if (debateResp?.changedVote) {
      return {
        ...review,
        vote: debateResp.changedVote,
        reason: debateResp.newReason || review.reason,
        debateResponse: debateResp.response,
      };
    }
    return review;
  });

  console.log(`🗣️ Debate Round ${round} complete.`);

  return {
    round,
    responses,
    finalVotes,
  };
}

/**
 * 전체 토론 프로세스 실행
 */
export async function runDebate(
  provider: LLMProvider,
  personas: Persona[],
  reviews: ReviewResult[],
  context: PRContext,
  config: DebateConfig = DEFAULT_DEBATE_CONFIG,
): Promise<ReviewResult[]> {
  if (!needsDebate(reviews, config)) {
    console.log("ℹ️ No debate needed (unanimous decision or debate disabled)");
    return reviews;
  }

  console.log(
    `\n💬 Starting MAGI Debate (max ${config.maxRounds} round(s))...`,
  );

  let currentReviews = reviews;

  for (let round = 1; round <= config.maxRounds; round++) {
    // 더 이상 토론이 필요 없으면 중단
    if (!needsDebate(currentReviews, { ...config, trigger: "disagreement" })) {
      console.log("✅ Consensus reached, ending debate early.");
      break;
    }

    const result = await runDebateRound(
      provider,
      personas,
      currentReviews,
      context,
      round,
    );

    currentReviews = result.finalVotes;
  }

  console.log("💬 Debate complete.\n");
  return currentReviews;
}

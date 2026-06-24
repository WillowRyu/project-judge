import { LLMProvider, ProviderType } from "../providers/provider.interface";
import { GeminiProvider } from "../providers/gemini.provider";
import { ProviderRegistry } from "../providers/registry";
import {
  Persona,
  ReviewResult,
  VoteResult,
} from "../personas/persona.interface";
import {
  AnalyzedDiff,
  getTotalChangedLines,
  needsCompression,
  smartCompressDiff,
} from "./diff-analyzer";
import {
  selectModelForDiff,
  formatTierInfo,
  TierConfig,
} from "./tiered-model-selector";

/**
 * Review Orchestrator
 * 3개 페르소나를 병렬로 실행하여 리뷰 수행
 * - 계층적 리뷰: Diff 크기에 따른 모델 자동 선택
 * - Context Caching: 동일 PR 컨텍스트 재사용
 * - 프롬프트 압축: 대형 PR용 토큰 최적화
 */

export interface PRContext {
  title: string;
  body: string;
  diff: AnalyzedDiff;
  author: string;
  baseBranch: string;
  headBranch: string;
}

export interface ReviewOptions {
  enableCaching?: boolean; // Context Caching 활성화 (기본: true)
  enableCompression?: boolean; // 대형 PR 압축 (기본: true)
  tieredModels?: TierConfig; // 계층별 모델 커스터마이징
}

/**
 * PR 컨텍스트를 문자열로 변환 (캐싱용)
 */
function buildPRContextString(
  context: PRContext,
  useCompression: boolean,
): string {
  // 대형 PR이고 압축 필요 시 smartCompressDiff 사용
  const diffContent =
    useCompression && needsCompression(context.diff)
      ? smartCompressDiff(context.diff.files)
      : context.diff.compressedDiff;

  return `## 리뷰 대상 Pull Request

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
${diffContent}
\`\`\``;
}

/**
 * 페르소나 전용 프롬프트 생성 (캐시 사용 시)
 */
function buildPersonaPrompt(persona: Persona): string {
  return `${persona.guideline}

---

위 PR 컨텍스트를 바탕으로 이 PR을 리뷰해주세요.
반드시 지정된 JSON 형식으로만 응답해주세요.`;
}

/**
 * 전체 프롬프트 생성 (캐시 미사용 시)
 */
function buildFullPrompt(
  persona: Persona,
  context: PRContext,
  useCompression: boolean,
): string {
  const prContext = buildPRContextString(context, useCompression);
  return `${persona.guideline}

---

${prContext}

---

위 지침에 따라 이 PR을 리뷰해주세요.
반드시 지정된 JSON 형식으로만 응답해주세요.`;
}

interface PersonaPlan {
  provider: LLMProvider;
  model: string;
  useCache: boolean;
}

function planForPersona(
  registry: ProviderRegistry,
  persona: Persona,
  tierModel: string,
  cacheEligible: boolean,
): PersonaPlan {
  const overrideType: ProviderType | undefined =
    persona.provider && persona.provider !== registry.defaultType
      ? persona.provider
      : undefined;

  if (overrideType) {
    const provider = registry.get(overrideType);
    const model =
      persona.model ??
      (provider.getDefaultModel ? provider.getDefaultModel() : tierModel);
    return { provider, model, useCache: false };
  }

  const provider = registry.default;
  const model = persona.model ?? tierModel;
  const useCache = cacheEligible && !persona.model;
  return { provider, model, useCache };
}

/**
 * 단일 페르소나로 리뷰 수행 (캐시 지원)
 */
async function reviewWithPersona(
  provider: LLMProvider,
  persona: Persona,
  context: PRContext,
  model: string,
  useCache: boolean,
  cacheId: string | undefined,
  useCompression: boolean,
): Promise<ReviewResult> {
  try {
    let response: string;

    if (useCache && cacheId && provider instanceof GeminiProvider) {
      const personaPrompt = buildPersonaPrompt(persona);
      response = await provider.reviewWithCache(cacheId, personaPrompt, model);
    } else if (provider.reviewWithModel) {
      const fullPrompt = buildFullPrompt(persona, context, useCompression);
      response = await provider.reviewWithModel(fullPrompt, model);
    } else {
      const fullPrompt = buildFullPrompt(persona, context, useCompression);
      response = await provider.review(fullPrompt);
    }

    return parseReviewResponse(persona, response);
  } catch (error) {
    console.error(`Error reviewing with ${persona.name}:`, error);
    return {
      personaId: persona.id,
      personaName: persona.name,
      personaEmoji: persona.emoji,
      vote: "conditional", // error:true이므로 집계 제외됨
      error: true,
      errorKind: isRateLimitError(error) ? "rate_limit" : "other",
      reason: "리뷰 실행 중 오류 발생",
      details: `리뷰를 수행하는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
      suggestions: [],
    };
  }
}

/**
 * LLM 응답 파싱
 */
function parseReviewResponse(persona: Persona, response: string): ReviewResult {
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;
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
    const vote = inferVoteFromText(response);
    return {
      personaId: persona.id,
      personaName: persona.name,
      personaEmoji: persona.emoji,
      vote,
      reason: "응답 파싱 실패",
      details: response.slice(0, 1000),
      suggestions: [],
    };
  }
}

function validateVote(vote: unknown): VoteResult {
  if (vote === "approve" || vote === "reject" || vote === "conditional") {
    return vote;
  }
  return "conditional";
}

export function inferVoteFromText(text: string): VoteResult {
  const t = text.toLowerCase();

  // 거부 신호 우선 (부정형 approve 포함)
  if (
    t.includes("reject") ||
    t.includes("거부") ||
    t.includes("승인 불가") ||
    t.includes("cannot approve") ||
    t.includes("can't approve") ||
    t.includes("do not approve") ||
    t.includes("don't approve") ||
    t.includes("not approve")
  ) {
    return "reject";
  }

  if (t.includes("approve") || t.includes("승인")) {
    return "approve";
  }

  return "conditional";
}

/**
 * Rate limit 에러 체크
 */
function isRateLimitError(error: unknown): boolean {
  const errorMessage = String(error);
  return (
    errorMessage.includes("429") ||
    errorMessage.includes("RESOURCE_EXHAUSTED") ||
    errorMessage.includes("Resource exhausted")
  );
}

/**
 * 모든 페르소나로 리뷰 수행
 * - 병렬 실행
 * - Rate limit으로 실패한 페르소나만 순차 재시도(성공분 보존)
 */
export async function runReviews(
  registry: ProviderRegistry,
  personas: Persona[],
  context: PRContext,
  options: ReviewOptions = {},
): Promise<ReviewResult[]> {
  const { enableCaching = true, enableCompression = true, tieredModels } = options;

  const defaultProvider = registry.default;
  const changedLines = getTotalChangedLines(context.diff);
  const isGemini = defaultProvider instanceof GeminiProvider;
  const mode = isGemini ? defaultProvider.getMode() : "api-key";
  const modelTier = selectModelForDiff(changedLines, mode, tieredModels);

  console.log(`\n📊 Token Optimization Analysis:`);
  console.log(`   Total changes: ${changedLines} lines`);
  console.log(`   Tier: ${formatTierInfo(modelTier)}`);

  const useCompression = enableCompression && modelTier.useCompression;
  if (useCompression) {
    console.log(`   Compression: enabled (large PR detected)`);
  }

  // default 경로(커스텀 모델 없음) 페르소나가 2명 이상일 때만 캐시 의미 있음
  const defaultPathPersonas = personas.filter(
    (p) => (!p.provider || p.provider === registry.defaultType) && !p.model,
  );
  let cacheId: string | undefined;
  let cacheEligible = false;
  if (enableCaching && isGemini && defaultPathPersonas.length > 1) {
    try {
      const prContextString = buildPRContextString(context, useCompression);
      cacheId = await defaultProvider.createContextCache(
        prContextString,
        modelTier.model,
      );
      if (cacheId) {
        cacheEligible = true;
        console.log(`   Context Cache: created (reused by default-path personas)`);
      }
    } catch (error) {
      console.log(`   Context Cache: not available (${error})`);
    }
  }

  const reviewOne = (persona: Persona): Promise<ReviewResult> => {
    const plan = planForPersona(registry, persona, modelTier.model, cacheEligible);
    console.log(
      `  - ${persona.emoji} ${persona.name} reviewing with ${plan.provider.name}:${plan.model}...`,
    );
    return reviewWithPersona(
      plan.provider,
      persona,
      context,
      plan.model,
      plan.useCache,
      cacheId,
      useCompression,
    );
  };

  console.log(`\n🚀 Starting parallel reviews with ${personas.length} personas...`);
  const reviews = await Promise.all(personas.map((p) => reviewOne(p)));

  // rate limit으로 실패한 페르소나만 순차 재시도(성공분 보존)
  const rateLimited = reviews
    .map((r, i) => ({ r, i }))
    .filter((x) => x.r.error && x.r.errorKind === "rate_limit");

  if (rateLimited.length > 0) {
    console.log(
      `\n⚠️ Rate limit on ${rateLimited.length} persona(s). Retrying those sequentially...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
    for (let k = 0; k < rateLimited.length; k++) {
      const { i } = rateLimited[k];
      reviews[i] = await reviewOne(personas[i]);
      if (k < rateLimited.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  if (cacheId && isGemini) {
    await defaultProvider.clearCache();
  }

  console.log("✅ All reviews completed.");
  return reviews;
}

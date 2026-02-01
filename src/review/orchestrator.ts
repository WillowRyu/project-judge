import { LLMProvider } from "../providers/provider.interface";
import { GeminiProvider } from "../providers/gemini.provider";
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

/**
 * 단일 페르소나로 리뷰 수행 (캐시 지원)
 */
async function reviewWithPersona(
  provider: LLMProvider,
  persona: Persona,
  context: PRContext,
  model: string,
  cacheId?: string,
  useCompression: boolean = false,
): Promise<ReviewResult> {
  try {
    let response: string;

    // 캐시 사용 가능하고 GeminiProvider인 경우
    if (cacheId && provider instanceof GeminiProvider) {
      const personaPrompt = buildPersonaPrompt(persona);
      response = await provider.reviewWithCache(cacheId, personaPrompt, model);
    }
    // 페르소나별 모델 지정 시
    else if (persona.model && provider.reviewWithModel) {
      console.log(`    Using persona model: ${persona.model}`);
      const fullPrompt = buildFullPrompt(persona, context, useCompression);
      response = await provider.reviewWithModel(fullPrompt, persona.model);
    }
    // 계층적 모델 사용
    else if (provider.reviewWithModel) {
      const fullPrompt = buildFullPrompt(persona, context, useCompression);
      response = await provider.reviewWithModel(fullPrompt, model);
    }
    // 기본 모델 사용
    else {
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
      vote: "conditional",
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
 * 모든 페르소나로 병렬 리뷰 수행 (최적화 적용)
 */
export async function runReviews(
  provider: LLMProvider,
  personas: Persona[],
  context: PRContext,
  options: ReviewOptions = {},
): Promise<ReviewResult[]> {
  const {
    enableCaching = true,
    enableCompression = true,
    tieredModels,
  } = options;

  // 1. Diff 크기 분석 및 모델 선택
  const changedLines = getTotalChangedLines(context.diff);
  const isGemini = provider instanceof GeminiProvider;
  const mode = isGemini ? provider.getMode() : "api-key";
  const modelTier = selectModelForDiff(changedLines, mode, tieredModels);

  console.log(`\n📊 Token Optimization Analysis:`);
  console.log(`   Total changes: ${changedLines} lines`);
  console.log(`   Tier: ${formatTierInfo(modelTier)}`);

  // 2. 압축 필요 여부 확인
  const useCompression = enableCompression && modelTier.useCompression;
  if (useCompression) {
    console.log(`   Compression: enabled (large PR detected)`);
  }

  // 3. Context Caching 시도 (GeminiProvider + 캐싱 활성화 시)
  let cacheId: string | undefined;
  if (enableCaching && isGemini && personas.length > 1) {
    try {
      const prContextString = buildPRContextString(context, useCompression);
      cacheId = await provider.createContextCache(
        prContextString,
        modelTier.model,
      );
      if (cacheId) {
        console.log(`   Context Cache: created (3 personas will reuse)`);
      }
    } catch (error) {
      console.log(`   Context Cache: not available (${error})`);
    }
  }

  // 4. 병렬 리뷰 실행
  console.log(
    `\nStarting parallel reviews with ${personas.length} personas...`,
  );

  const reviews = await Promise.all(
    personas.map((persona) => {
      console.log(
        `  - ${persona.emoji} ${persona.name} reviewing with ${modelTier.model}...`,
      );
      return reviewWithPersona(
        provider,
        persona,
        context,
        modelTier.model,
        cacheId,
        useCompression,
      );
    }),
  );

  // 5. 캐시 정리
  if (cacheId && isGemini) {
    await provider.clearCache();
  }

  console.log("All reviews completed.");
  return reviews;
}

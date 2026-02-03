import { GoogleGenAI } from "@google/genai";
import { LLMProvider } from "./provider.interface";

/**
 * Gemini Provider
 * @google/genai SDK 사용 (API Key 및 Vertex AI 모두 지원)
 * - API Key 모드: Gemini Developer API 사용
 * - GCP 모드: Vertex AI API 사용
 * - Context Caching 지원: 동일 PR 컨텍스트 재사용
 */

interface GeminiConfig {
  mode: "api-key" | "gcp";
  apiKey?: string;
  gcpProjectId?: string;
  gcpLocation?: string;
  model?: string;
}

interface CachedContext {
  cacheId: string;
  model: string;
  createdAt: Date;
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private config: GeminiConfig;
  private client: GoogleGenAI;
  private cachedContext?: CachedContext;

  /**
   * 모델에 따라 적절한 location 반환
   * gemini-3 계열: 'global' 필수 (프리뷰 모델 제한)
   * 그 외: 'us-central1' (기본값)
   */
  private static getLocationForModel(model: string): string {
    if (model.startsWith("gemini-3")) {
      return "global";
    }
    return "us-central1";
  }

  constructor(config: GeminiConfig) {
    // 모드별 기본 모델 설정
    // GCP: gemini-3-pro-preview (global 지원), API Key: gemini-2.5-flash (빠른 속도)
    const defaultModel =
      config.mode === "gcp" ? "gemini-3-pro-preview" : "gemini-2.5-flash";

    const model = config.model ?? defaultModel;

    // gemini-3 모델은 'global' 리전 필수
    const location =
      config.gcpLocation ?? GeminiProvider.getLocationForModel(model);

    this.config = {
      ...config,
      model: model,
      gcpLocation: location,
    };

    // @google/genai SDK 초기화
    if (config.mode === "api-key") {
      if (!config.apiKey) {
        throw new Error("API Key is required for api-key mode");
      }
      this.client = new GoogleGenAI({
        apiKey: config.apiKey,
      });
    } else if (config.mode === "gcp") {
      if (!config.gcpProjectId) {
        throw new Error("GCP Project ID is required for gcp mode");
      }
      // Vertex AI 모드: Application Default Credentials 사용
      this.client = new GoogleGenAI({
        vertexai: true,
        project: config.gcpProjectId,
        location: this.config.gcpLocation!,
      });
    } else {
      throw new Error("Invalid mode");
    }
  }

  /**
   * API Key 모드용 정적 팩토리 메서드
   */
  static fromApiKey(apiKey: string, model?: string): GeminiProvider {
    return new GeminiProvider({
      mode: "api-key",
      apiKey,
      model,
    });
  }

  /**
   * GCP 모드용 정적 팩토리 메서드
   */
  static fromGCP(
    projectId: string,
    location?: string,
    model?: string,
  ): GeminiProvider {
    return new GeminiProvider({
      mode: "gcp",
      gcpProjectId: projectId,
      gcpLocation: location,
      model,
    });
  }

  /**
   * 기본 모델로 리뷰 수행
   */
  async review(prompt: string): Promise<string> {
    return this.reviewWithModel(prompt, this.config.model!);
  }

  /**
   * Retry with exponential backoff for rate limit errors
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 2000,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error as Error;
        const errorMessage = String(error);

        // 429 (Rate Limit) 또는 RESOURCE_EXHAUSTED 에러인 경우 재시도
        const isRateLimitError =
          errorMessage.includes("429") ||
          errorMessage.includes("RESOURCE_EXHAUSTED") ||
          errorMessage.includes("Resource exhausted");

        if (isRateLimitError && attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt); // 2s, 4s, 8s
          console.log(
            `  ⏳ Rate limit hit, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`,
          );
          await this.sleep(delay);
        } else if (!isRateLimitError) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 특정 모델로 리뷰 수행 (페르소나별 모델 지원)
   * Rate limit 에러 시 자동 재시도 (exponential backoff)
   */
  async reviewWithModel(prompt: string, model: string): Promise<string> {
    const modelLocation = GeminiProvider.getLocationForModel(model);
    let clientToUse = this.client;

    if (
      this.config.mode === "gcp" &&
      modelLocation !== this.config.gcpLocation
    ) {
      clientToUse = new GoogleGenAI({
        vertexai: true,
        project: this.config.gcpProjectId!,
        location: modelLocation,
      });
    }

    return this.withRetry(async () => {
      const response = await clientToUse.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
        },
      });

      return response.text ?? "";
    });
  }

  /**
   * 현재 모드의 기본 모델명 반환
   */
  getDefaultModel(): string {
    return this.config.model!;
  }

  /**
   * 현재 인증 모드 반환
   */
  getMode(): "api-key" | "gcp" {
    return this.config.mode;
  }

  /**
   * Context Cache 생성
   * PR 컨텍스트를 캐시하여 여러 페르소나가 재사용
   * @param prContext - 캐시할 PR 컨텍스트 (diff, 설명 등)
   * @param model - 캐시에 사용할 모델
   * @returns 캐시 ID
   */
  async createContextCache(prContext: string, model: string): Promise<string> {
    try {
      console.log(`  Creating context cache for model: ${model}`);

      // gemini-3 계열은 global location 필요
      const modelLocation = GeminiProvider.getLocationForModel(model);
      let clientToUse = this.client;

      if (
        this.config.mode === "gcp" &&
        modelLocation !== this.config.gcpLocation
      ) {
        console.log(`  Using ${modelLocation} location for caching`);
        clientToUse = new GoogleGenAI({
          vertexai: true,
          project: this.config.gcpProjectId!,
          location: modelLocation,
        });
      }

      const cacheResponse = await clientToUse.caches.create({
        model: model,
        config: {
          contents: [
            {
              role: "user",
              parts: [{ text: prContext }],
            },
          ],
          displayName: `magi-pr-review-${Date.now()}`,
          ttl: "3600s", // 1시간 TTL
        },
      });

      const cacheId = cacheResponse.name ?? "";
      this.cachedContext = {
        cacheId,
        model,
        createdAt: new Date(),
      };

      console.log(`  Context cache created: ${cacheId}`);
      return cacheId;
    } catch (error) {
      console.warn(
        "  Context caching not available, using direct calls:",
        error,
      );
      return "";
    }
  }

  /**
   * 캐시된 컨텍스트로 리뷰 수행
   */
  async reviewWithCache(
    cacheId: string,
    personaPrompt: string,
    model: string,
  ): Promise<string> {
    if (!cacheId) {
      // 캐시 없으면 일반 호출
      return this.reviewWithModel(personaPrompt, model);
    }

    try {
      console.log(`  Using cached context: ${cacheId.slice(-20)}`);

      // gemini-3 계열은 global location 필요
      const modelLocation = GeminiProvider.getLocationForModel(model);
      let clientToUse = this.client;

      if (
        this.config.mode === "gcp" &&
        modelLocation !== this.config.gcpLocation
      ) {
        clientToUse = new GoogleGenAI({
          vertexai: true,
          project: this.config.gcpProjectId!,
          location: modelLocation,
        });
      }

      const response = await this.withRetry(async () => {
        return clientToUse.models.generateContent({
          model: model,
          contents: personaPrompt,
          config: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            cachedContent: cacheId,
          },
        });
      });

      return response.text ?? "";
    } catch (error) {
      console.warn("  Cache usage failed, falling back to direct call:", error);
      return this.reviewWithModel(personaPrompt, model);
    }
  }

  /**
   * 캐시 정리
   */
  async clearCache(): Promise<void> {
    if (this.cachedContext?.cacheId) {
      try {
        await this.client.caches.delete({ name: this.cachedContext.cacheId });
        console.log("  Context cache cleared");
      } catch {
        // 삭제 실패해도 무시 (TTL로 자동 삭제됨)
      }
      this.cachedContext = undefined;
    }
  }

  /**
   * 캐시 정보 반환
   */
  getCachedContext(): CachedContext | undefined {
    return this.cachedContext;
  }
}

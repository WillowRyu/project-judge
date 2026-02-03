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
export declare class GeminiProvider implements LLMProvider {
    readonly name = "gemini";
    private config;
    private client;
    private cachedContext?;
    /**
     * 모델에 따라 적절한 location 반환
     * gemini-3 계열: 'global' 필수 (프리뷰 모델 제한)
     * 그 외: 'us-central1' (기본값)
     */
    private static getLocationForModel;
    constructor(config: GeminiConfig);
    /**
     * API Key 모드용 정적 팩토리 메서드
     */
    static fromApiKey(apiKey: string, model?: string): GeminiProvider;
    /**
     * GCP 모드용 정적 팩토리 메서드
     */
    static fromGCP(projectId: string, location?: string, model?: string): GeminiProvider;
    /**
     * 기본 모델로 리뷰 수행
     */
    review(prompt: string): Promise<string>;
    /**
     * Retry with exponential backoff for rate limit errors
     */
    private withRetry;
    private sleep;
    /**
     * 특정 모델로 리뷰 수행 (페르소나별 모델 지원)
     * Rate limit 에러 시 자동 재시도 (exponential backoff)
     */
    reviewWithModel(prompt: string, model: string): Promise<string>;
    /**
     * 현재 모드의 기본 모델명 반환
     */
    getDefaultModel(): string;
    /**
     * 현재 인증 모드 반환
     */
    getMode(): "api-key" | "gcp";
    /**
     * Context Cache 생성
     * PR 컨텍스트를 캐시하여 여러 페르소나가 재사용
     * @param prContext - 캐시할 PR 컨텍스트 (diff, 설명 등)
     * @param model - 캐시에 사용할 모델
     * @returns 캐시 ID
     */
    createContextCache(prContext: string, model: string): Promise<string>;
    /**
     * 캐시된 컨텍스트로 리뷰 수행
     */
    reviewWithCache(cacheId: string, personaPrompt: string, model: string): Promise<string>;
    /**
     * 캐시 정리
     */
    clearCache(): Promise<void>;
    /**
     * 캐시 정보 반환
     */
    getCachedContext(): CachedContext | undefined;
}
export {};
//# sourceMappingURL=gemini.provider.d.ts.map
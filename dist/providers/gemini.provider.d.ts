import { LLMProvider } from "./provider.interface";
/**
 * Gemini Provider
 * @google/genai SDK 사용 (API Key 및 Vertex AI 모두 지원)
 * - API Key 모드: Gemini Developer API 사용
 * - GCP 모드: Vertex AI API 사용
 */
interface GeminiConfig {
    mode: "api-key" | "gcp";
    apiKey?: string;
    gcpProjectId?: string;
    gcpLocation?: string;
    model?: string;
}
export declare class GeminiProvider implements LLMProvider {
    readonly name = "gemini";
    private config;
    private client;
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
     * 특정 모델로 리뷰 수행 (페르소나별 모델 지원)
     */
    reviewWithModel(prompt: string, model: string): Promise<string>;
    /**
     * 현재 모드의 기본 모델명 반환
     */
    getDefaultModel(): string;
}
export {};
//# sourceMappingURL=gemini.provider.d.ts.map
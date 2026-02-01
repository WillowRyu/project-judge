import { LLMProvider } from "./provider.interface";
/**
 * Gemini Provider
 * Google Gemini API (API Key) 또는 Vertex AI (GCP) 지원
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
    private genAIClient?;
    private vertexClient?;
    constructor(config: GeminiConfig);
    /**
     * API Key 모드용 정적 팩토리 메서드
     */
    static fromApiKey(apiKey: string, model?: string): GeminiProvider;
    /**
     * GCP 모드용 정적 팩토리 메서드
     */
    static fromGCP(projectId: string, location?: string, model?: string): GeminiProvider;
    review(prompt: string): Promise<string>;
    private reviewWithGenAI;
    private reviewWithVertexAI;
}
export {};
//# sourceMappingURL=gemini.provider.d.ts.map
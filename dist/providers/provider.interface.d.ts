/**
 * LLM Provider Interface
 * 다양한 AI 모델을 쉽게 교체할 수 있도록 추상화
 */
export interface LLMProvider {
    readonly name: string;
    review(prompt: string): Promise<string>;
}
export interface ProviderConfig {
    type: "gemini" | "openai" | "claude";
    apiKey?: string;
    gcpCredentials?: string;
    model?: string;
}
//# sourceMappingURL=provider.interface.d.ts.map
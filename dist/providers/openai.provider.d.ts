import { LLMProvider } from "./provider.interface";
export declare class OpenAIProvider implements LLMProvider {
    readonly name = "openai";
    private client;
    private model;
    constructor(apiKey: string, model?: string);
    /**
     * 기본 모델로 리뷰 수행
     */
    review(prompt: string): Promise<string>;
    /**
     * 특정 모델로 리뷰 수행
     */
    reviewWithModel(prompt: string, model: string): Promise<string>;
    /**
     * 기본 모델명 반환
     */
    getDefaultModel(): string;
}
//# sourceMappingURL=openai.provider.d.ts.map
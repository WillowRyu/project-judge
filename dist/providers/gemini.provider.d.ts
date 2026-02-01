import { LLMProvider } from "./provider.interface";
/**
 * Gemini Provider
 * Google Gemini API를 사용한 LLM Provider 구현
 */
export declare class GeminiProvider implements LLMProvider {
    readonly name = "gemini";
    private client;
    private model;
    constructor(apiKey: string, model?: string);
    review(prompt: string): Promise<string>;
}
//# sourceMappingURL=gemini.provider.d.ts.map
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMProvider } from "./provider.interface";

/**
 * Gemini Provider
 * Google Gemini API를 사용한 LLM Provider 구현
 */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model ?? "gemini-2.0-flash";
  }

  async review(prompt: string): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  }
}

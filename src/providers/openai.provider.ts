import OpenAI from "openai";
import { LLMProvider } from "./provider.interface";

/**
 * OpenAI Provider
 * OpenAI Responses API adapter
 */

const DEFAULT_MODEL = "gpt-5.5";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey, timeout: 120_000 });
    this.model = model ?? DEFAULT_MODEL;
  }

  /**
   * 기본 모델로 리뷰 수행
   */
  async review(prompt: string): Promise<string> {
    return this.reviewWithModel(prompt, this.model);
  }

  /**
   * 특정 모델로 리뷰 수행
   */
  async reviewWithModel(prompt: string, model: string): Promise<string> {
    const response = await this.client.responses.create({
      model,
      input: prompt,
      max_output_tokens: 8192,
      store: false,
    });
    if (response.status !== "completed") {
      throw new Error("OpenAI response was incomplete");
    }
    if (!response.output_text?.trim()) {
      throw new Error("OpenAI response was empty");
    }
    return response.output_text;
  }

  /**
   * 기본 모델명 반환
   */
  getDefaultModel(): string {
    return this.model;
  }
}

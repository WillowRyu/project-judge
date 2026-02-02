import OpenAI from "openai";
import { LLMProvider } from "./provider.interface";

/**
 * OpenAI Provider
 * GPT-5.2 등 OpenAI 모델 지원
 */

const DEFAULT_MODEL = "gpt-5.2";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey });
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
    const response = await this.client.chat.completions.create({
      model: model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    });

    return response.choices[0]?.message?.content ?? "";
  }

  /**
   * 기본 모델명 반환
   */
  getDefaultModel(): string {
    return this.model;
  }
}

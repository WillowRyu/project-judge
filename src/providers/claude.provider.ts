import Anthropic from "@anthropic-ai/sdk";
import { LLMProvider } from "./provider.interface";

/**
 * Claude Provider
 * Claude 4.5 Sonnet 등 Anthropic 모델 지원
 */

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export class ClaudeProvider implements LLMProvider {
  readonly name = "claude";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
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
    const response = await this.client.messages.create({
      model: model,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Claude API는 content가 배열로 반환됨
    const textContent = response.content.find((block) => block.type === "text");
    return textContent?.type === "text" ? textContent.text : "";
  }

  /**
   * 기본 모델명 반환
   */
  getDefaultModel(): string {
    return this.model;
  }
}

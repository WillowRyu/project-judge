import { GoogleGenerativeAI } from "@google/generative-ai";
import { VertexAI } from "@google-cloud/vertexai";
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

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private config: GeminiConfig;
  private genAIClient?: GoogleGenerativeAI;
  private vertexClient?: VertexAI;

  constructor(config: GeminiConfig) {
    // 모드별 기본 모델 설정
    // GCP: gemini-3-pro-preview (최신 프리뷰), API Key: gemini-2.5-flash (빠른 속도)
    const defaultModel =
      config.mode === "gcp" ? "gemini-3-pro-preview" : "gemini-2.5-flash";

    this.config = {
      ...config,
      model: config.model ?? defaultModel,
      gcpLocation: config.gcpLocation ?? "us-central1",
    };

    if (config.mode === "api-key") {
      if (!config.apiKey) {
        throw new Error("API Key is required for api-key mode");
      }
      this.genAIClient = new GoogleGenerativeAI(config.apiKey);
    } else if (config.mode === "gcp") {
      if (!config.gcpProjectId) {
        throw new Error("GCP Project ID is required for gcp mode");
      }
      // Vertex AI는 환경변수의 GOOGLE_APPLICATION_CREDENTIALS 또는
      // GitHub Actions의 gcloud auth를 통해 인증됨
      this.vertexClient = new VertexAI({
        project: config.gcpProjectId,
        location: this.config.gcpLocation!,
      });
    }
  }

  /**
   * API Key 모드용 정적 팩토리 메서드
   */
  static fromApiKey(apiKey: string, model?: string): GeminiProvider {
    return new GeminiProvider({
      mode: "api-key",
      apiKey,
      model,
    });
  }

  /**
   * GCP 모드용 정적 팩토리 메서드
   */
  static fromGCP(
    projectId: string,
    location?: string,
    model?: string,
  ): GeminiProvider {
    return new GeminiProvider({
      mode: "gcp",
      gcpProjectId: projectId,
      gcpLocation: location,
      model,
    });
  }

  /**
   * 기본 모델로 리뷰 수행
   */
  async review(prompt: string): Promise<string> {
    return this.reviewWithModel(prompt, this.config.model!);
  }

  /**
   * 특정 모델로 리뷰 수행 (페르소나별 모델 지원)
   */
  async reviewWithModel(prompt: string, model: string): Promise<string> {
    if (this.config.mode === "api-key" && this.genAIClient) {
      return this.reviewWithGenAI(prompt, model);
    } else if (this.config.mode === "gcp" && this.vertexClient) {
      return this.reviewWithVertexAI(prompt, model);
    }
    throw new Error("Invalid provider configuration");
  }

  /**
   * 현재 모드의 기본 모델명 반환
   */
  getDefaultModel(): string {
    return this.config.model!;
  }

  private async reviewWithGenAI(
    prompt: string,
    model: string,
  ): Promise<string> {
    const modelInstance = this.genAIClient!.getGenerativeModel({
      model: model,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    const result = await modelInstance.generateContent(prompt);
    const response = result.response;
    return response.text();
  }

  private async reviewWithVertexAI(
    prompt: string,
    model: string,
  ): Promise<string> {
    const modelInstance = this.vertexClient!.getGenerativeModel({
      model: model,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    const result = await modelInstance.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const response = result.response;
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      return parts.map((p) => ("text" in p ? p.text : "")).join("");
    }
    return "";
  }
}

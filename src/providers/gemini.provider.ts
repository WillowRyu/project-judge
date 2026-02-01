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
    this.config = {
      ...config,
      model: config.model ?? "gemini-2.0-flash",
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

  async review(prompt: string): Promise<string> {
    if (this.config.mode === "api-key" && this.genAIClient) {
      return this.reviewWithGenAI(prompt);
    } else if (this.config.mode === "gcp" && this.vertexClient) {
      return this.reviewWithVertexAI(prompt);
    }
    throw new Error("Invalid provider configuration");
  }

  private async reviewWithGenAI(prompt: string): Promise<string> {
    const model = this.genAIClient!.getGenerativeModel({
      model: this.config.model!,
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

  private async reviewWithVertexAI(prompt: string): Promise<string> {
    const model = this.vertexClient!.getGenerativeModel({
      model: this.config.model!,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    const result = await model.generateContent({
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

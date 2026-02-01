import { GoogleGenAI } from "@google/genai";
import { LLMProvider } from "./provider.interface";

/**
 * Gemini Provider
 * @google/genai SDK 사용 (API Key 및 Vertex AI 모두 지원)
 * - API Key 모드: Gemini Developer API 사용
 * - GCP 모드: Vertex AI API 사용
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
  private client: GoogleGenAI;

  /**
   * 모델에 따라 적절한 location 반환
   * gemini-3 계열: 'global' 필수 (프리뷰 모델 제한)
   * 그 외: 'us-central1' (기본값)
   */
  private static getLocationForModel(model: string): string {
    if (model.startsWith("gemini-3")) {
      return "global";
    }
    return "us-central1";
  }

  constructor(config: GeminiConfig) {
    // 모드별 기본 모델 설정
    // GCP: gemini-3-pro-preview (global 지원), API Key: gemini-2.5-flash (빠른 속도)
    const defaultModel =
      config.mode === "gcp" ? "gemini-3-pro-preview" : "gemini-2.5-flash";

    const model = config.model ?? defaultModel;

    // gemini-3 모델은 'global' 리전 필수
    const location =
      config.gcpLocation ?? GeminiProvider.getLocationForModel(model);

    this.config = {
      ...config,
      model: model,
      gcpLocation: location,
    };

    // @google/genai SDK 초기화
    if (config.mode === "api-key") {
      if (!config.apiKey) {
        throw new Error("API Key is required for api-key mode");
      }
      this.client = new GoogleGenAI({
        apiKey: config.apiKey,
      });
    } else if (config.mode === "gcp") {
      if (!config.gcpProjectId) {
        throw new Error("GCP Project ID is required for gcp mode");
      }
      // Vertex AI 모드: Application Default Credentials 사용
      this.client = new GoogleGenAI({
        vertexai: true,
        project: config.gcpProjectId,
        location: this.config.gcpLocation!,
      });
    } else {
      throw new Error("Invalid mode");
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
    // gemini-3 계열 모델이 다른 location 필요한 경우 새 클라이언트 생성
    const modelLocation = GeminiProvider.getLocationForModel(model);
    let clientToUse = this.client;

    if (
      this.config.mode === "gcp" &&
      modelLocation !== this.config.gcpLocation
    ) {
      clientToUse = new GoogleGenAI({
        vertexai: true,
        project: this.config.gcpProjectId!,
        location: modelLocation,
      });
    }

    const response = await clientToUse.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    return response.text ?? "";
  }

  /**
   * 현재 모드의 기본 모델명 반환
   */
  getDefaultModel(): string {
    return this.config.model!;
  }
}

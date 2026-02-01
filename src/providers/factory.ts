import { LLMProvider, ProviderConfig } from "./provider.interface";
import { GeminiProvider } from "./gemini.provider";

/**
 * Provider Factory
 * 설정에 따라 적절한 LLM Provider 생성
 */
export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case "gemini":
      // GCP 모드 우선 체크 (projectId가 있으면 GCP 모드)
      if (config.gcpProjectId) {
        return GeminiProvider.fromGCP(
          config.gcpProjectId,
          config.gcpLocation,
          config.model,
        );
      }
      // API Key 모드
      if (config.apiKey) {
        return GeminiProvider.fromApiKey(config.apiKey, config.model);
      }
      throw new Error(
        "Gemini requires either API key (gemini_api_key) or GCP credentials (gcp_project_id)",
      );

    case "openai":
      throw new Error(
        "OpenAI provider is not yet implemented. Coming in Phase 2.",
      );

    case "claude":
      throw new Error(
        "Claude provider is not yet implemented. Coming in Phase 2.",
      );

    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

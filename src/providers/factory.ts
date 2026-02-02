import { LLMProvider, ProviderConfig } from "./provider.interface";
import { GeminiProvider } from "./gemini.provider";
import { OpenAIProvider } from "./openai.provider";
import { ClaudeProvider } from "./claude.provider";

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
      if (!config.apiKey) {
        throw new Error("OpenAI requires API key (openai_api_key)");
      }
      return new OpenAIProvider(config.apiKey, config.model);

    case "claude":
      if (!config.apiKey) {
        throw new Error("Claude requires API key (anthropic_api_key)");
      }
      return new ClaudeProvider(config.apiKey, config.model);

    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

import { LLMProvider, ProviderConfig } from "./provider.interface";
import { GeminiProvider } from "./gemini.provider";

/**
 * Provider Factory
 * 설정에 따라 적절한 LLM Provider 생성
 */
export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case "gemini":
      if (!config.apiKey) {
        throw new Error("Gemini API key is required");
      }
      return new GeminiProvider(config.apiKey, config.model);

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

import { LLMProvider, ProviderType } from "./provider.interface";
import { createProvider } from "./factory";

export interface ProviderCredentials {
  geminiApiKey?: string;
  gcpProjectId?: string;
  gcpLocation?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export interface ProviderRegistry {
  defaultType: ProviderType;
  default: LLMProvider;
  get(type: ProviderType): LLMProvider;
  has(type: ProviderType): boolean;
}

/**
 * 해당 provider 타입에 필요한 자격증명이 있는지 확인
 */
export function hasCredentials(
  type: ProviderType,
  creds: ProviderCredentials,
): boolean {
  switch (type) {
    case "gemini":
      return !!creds.geminiApiKey || !!creds.gcpProjectId;
    case "openai":
      return !!creds.openaiApiKey;
    case "claude":
      return !!creds.anthropicApiKey;
    default:
      return false;
  }
}

/**
 * 자격증명으로 타입별 provider를 생성하는 레지스트리.
 * default 타입은 즉시 생성, 그 외는 최초 요청 시 lazy 생성.
 * defaultModel은 default 타입에만 적용(페르소나별 모델은 호출 시 지정).
 */
export function createProviderRegistry(
  creds: ProviderCredentials,
  defaultType: ProviderType,
  defaultModel?: string,
): ProviderRegistry {
  const cache = new Map<ProviderType, LLMProvider>();

  const build = (type: ProviderType): LLMProvider => {
    const model = type === defaultType ? defaultModel : undefined;
    switch (type) {
      case "gemini":
        return createProvider({
          type: "gemini",
          apiKey: creds.geminiApiKey,
          gcpProjectId: creds.gcpProjectId,
          gcpLocation: creds.gcpLocation,
          model,
        });
      case "openai":
        return createProvider({
          type: "openai",
          apiKey: creds.openaiApiKey,
          model,
        });
      case "claude":
        return createProvider({
          type: "claude",
          apiKey: creds.anthropicApiKey,
          model,
        });
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  };

  const get = (type: ProviderType): LLMProvider => {
    const existing = cache.get(type);
    if (existing) return existing;
    const created = build(type);
    cache.set(type, created);
    return created;
  };

  return {
    defaultType,
    default: get(defaultType),
    get,
    has: (type: ProviderType) => hasCredentials(type, creds),
  };
}

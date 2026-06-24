import { LLMProvider, ProviderType } from "./provider.interface";
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
export declare function hasCredentials(type: ProviderType, creds: ProviderCredentials): boolean;
/**
 * 자격증명으로 타입별 provider를 생성하는 레지스트리.
 * default 타입은 즉시 생성, 그 외는 최초 요청 시 lazy 생성.
 * defaultModel은 default 타입에만 적용(페르소나별 모델은 호출 시 지정).
 */
export declare function createProviderRegistry(creds: ProviderCredentials, defaultType: ProviderType, defaultModel?: string): ProviderRegistry;
//# sourceMappingURL=registry.d.ts.map
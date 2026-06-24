import { describe, expect, it } from "vitest";
import { createProviderRegistry, hasCredentials } from "./registry";

describe("hasCredentials", () => {
  it("gemini accepts api key or gcp project", () => {
    expect(hasCredentials("gemini", { geminiApiKey: "k" })).toBe(true);
    expect(hasCredentials("gemini", { gcpProjectId: "p" })).toBe(true);
    expect(hasCredentials("gemini", {})).toBe(false);
  });
  it("openai/claude require their keys", () => {
    expect(hasCredentials("openai", { openaiApiKey: "k" })).toBe(true);
    expect(hasCredentials("openai", {})).toBe(false);
    expect(hasCredentials("claude", { anthropicApiKey: "k" })).toBe(true);
    expect(hasCredentials("claude", {})).toBe(false);
  });
});

describe("createProviderRegistry", () => {
  it("builds the default provider and resolves others lazily", () => {
    const reg = createProviderRegistry(
      { geminiApiKey: "g", openaiApiKey: "o" },
      "gemini",
    );
    expect(reg.defaultType).toBe("gemini");
    expect(reg.default.name).toBe("gemini");
    expect(reg.get("openai").name).toBe("openai");
    expect(reg.has("openai")).toBe(true);
    expect(reg.has("claude")).toBe(false);
  });

  it("throws when resolving a provider without credentials", () => {
    const reg = createProviderRegistry({ geminiApiKey: "g" }, "gemini");
    expect(() => reg.get("claude")).toThrow();
  });
});

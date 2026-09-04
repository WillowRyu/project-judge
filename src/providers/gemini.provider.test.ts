import { beforeEach, describe, expect, it, vi } from "vitest";

const constructed: unknown[] = [];
const generateContent = vi.fn().mockResolvedValue({ text: "ok" });
const cacheCreate = vi.fn();
const cacheDelete = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
    caches = { create: cacheCreate, delete: cacheDelete };
    constructor(config: unknown) {
      constructed.push(config);
    }
  },
}));

import { GeminiProvider } from "./gemini.provider";

describe("GeminiProvider", () => {
  beforeEach(() => {
    constructed.length = 0;
    generateContent.mockReset().mockResolvedValue({ text: "ok" });
  });

  it("uses stable Gemini 3.5 defaults", () => {
    expect(GeminiProvider.fromApiKey("key").getDefaultModel()).toBe("gemini-3.5-flash");
  });

  it("rejects empty model output", async () => {
    generateContent.mockResolvedValueOnce({ text: "" });
    await expect(GeminiProvider.fromApiKey("key").review("prompt")).rejects.toThrow(/empty/i);
  });

  it("rejects output stopped by the token limit", async () => {
    generateContent.mockResolvedValueOnce({
      text: "partial",
      candidates: [{ finishReason: "MAX_TOKENS" }],
    });
    await expect(GeminiProvider.fromApiKey("key").review("prompt")).rejects.toThrow(/incomplete/i);
  });

  it("keeps an explicitly requested GCP location for an auto-global model", async () => {
    const provider = GeminiProvider.fromGCP("project", "asia-northeast3", "gemini-3.5-flash");
    await provider.review("prompt");

    expect(constructed).toHaveLength(1);
    expect(constructed[0]).toMatchObject({
      vertexai: true,
      project: "project",
      location: "asia-northeast3",
    });
  });
});

it('does not log raw request data when cache creation fails', async () => {
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  cacheCreate.mockRejectedValueOnce(Object.assign(new Error('cache unavailable'),{request:{prompt:'PRIVATE_PROMPT_SENTINEL',headers:{authorization:'PRIVATE_KEY_SENTINEL'}}}));
  try {
    await expect(GeminiProvider.fromApiKey('dummy').createContextCache('private context','gemini-3.5-flash')).resolves.toBe('');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('PRIVATE_');
  } finally {warn.mockRestore();}
});

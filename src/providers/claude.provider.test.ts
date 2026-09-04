import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
    constructor(_config: unknown) {}
  },
}));

import { ClaudeProvider } from "./claude.provider";

describe("ClaudeProvider", () => {
  beforeEach(() => create.mockReset().mockResolvedValue({ content: [{ type: "text", text: "ok" }] }));

  it("uses the Claude Sonnet 5 default", () => {
    expect(new ClaudeProvider("key").getDefaultModel()).toBe("claude-sonnet-5");
  });

  it("rejects empty model output", async () => {
    create.mockResolvedValueOnce({ content: [] });
    await expect(new ClaudeProvider("key").review("prompt")).rejects.toThrow(/empty/i);
  });

  it("rejects output stopped by the token limit", async () => {
    create.mockResolvedValueOnce({
      content: [{ type: "text", text: "partial" }],
      stop_reason: "max_tokens",
    });
    await expect(new ClaudeProvider("key").review("prompt")).rejects.toThrow(/incomplete/i);
  });
});

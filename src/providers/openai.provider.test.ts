import { describe, expect, it, vi } from "vitest";

const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: "ok" } }] });

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts: unknown) {}
  },
}));

import { OpenAIProvider } from "./openai.provider";

describe("OpenAIProvider", () => {
  it("uses max_completion_tokens and omits the temperature override", async () => {
    const p = new OpenAIProvider("key", "gpt-5.2");
    const out = await p.review("hi");
    expect(out).toBe("ok");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-5.2", max_completion_tokens: 8192 }),
    );
    const arg = create.mock.calls[0][0];
    expect(arg).not.toHaveProperty("temperature");
    expect(arg).not.toHaveProperty("max_tokens");
  });
});

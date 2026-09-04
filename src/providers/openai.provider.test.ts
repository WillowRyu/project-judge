import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn().mockResolvedValue({ output_text: "ok", status: "completed" });

vi.mock("openai", () => ({
  default: class {
    responses = { create };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts: unknown) {}
  },
}));

import { OpenAIProvider } from "./openai.provider";

describe("OpenAIProvider", () => {
  beforeEach(() => create.mockClear());

  it("uses the Responses API with non-persisted input", async () => {
    const p = new OpenAIProvider("key", "gpt-5.5");
    const out = await p.review("hi");
    expect(out).toBe("ok");
    expect(create).toHaveBeenCalledWith(
      { model: "gpt-5.5", input: "hi", max_output_tokens: 8192, store: false },
    );
  });

  it("rejects incomplete or empty Responses API output", async () => {
    create.mockResolvedValueOnce({ output_text: "", status: "incomplete" });
    const p = new OpenAIProvider("key");

    await expect(p.review("hi")).rejects.toThrow(/incomplete|empty/i);
  });

  it("rejects any Responses API status other than completed", async () => {
    create.mockResolvedValueOnce({ output_text: "partial", status: "failed" });
    const p = new OpenAIProvider("key");

    await expect(p.review("hi")).rejects.toThrow(/incomplete/i);
  });
});

import { describe, expect, it, vi } from "vitest";
import { runReviews, inferVoteFromText } from "./orchestrator";
import type { PRContext } from "./orchestrator";
import type { ProviderRegistry } from "../providers";
import type { LLMProvider } from "../providers/provider.interface";
import { GeminiProvider } from "../providers/gemini.provider";
import type { Persona } from "../personas/persona.interface";

const APPROVE_JSON =
  '```json\n{"vote":"approve","reason":"ok","details":"","suggestions":[]}\n```';

function persona(id: string, over: Partial<Persona> = {}): Persona {
  return { id, name: id.toUpperCase(), emoji: "🤖", role: "R", guideline: `GUIDE_${id}`, ...over };
}

function ctx(): PRContext {
  return {
    title: "t",
    body: "b",
    author: "a",
    baseBranch: "main",
    headBranch: "f",
    diff: { summary: "s", files: [], totalAdditions: 5, totalDeletions: 1, compressedDiff: "@@\n+x" },
  };
}

function fakeProvider(name: string, fn: (prompt: string, model: string) => Promise<string>): LLMProvider {
  return {
    name,
    review: vi.fn((p: string) => fn(p, "default")),
    reviewWithModel: vi.fn((p: string, m: string) => fn(p, m)),
    getDefaultModel: () => `${name}-default`,
  };
}

function registryOf(def: LLMProvider, others: Record<string, LLMProvider> = {}): ProviderRegistry {
  return {
    defaultType: "gemini",
    default: def,
    get: (t) => others[t] ?? def,
    has: () => true,
  };
}

describe("runReviews", () => {
  it("uses an explicit global default model on the default provider path", async () => {
    const def = fakeProvider("openai", async () => APPROVE_JSON);
    await runReviews(registryOf(def), [persona("a")], ctx(), {
      enableCaching: false,
      defaultModel: "gpt-explicit",
    });

    expect(def.reviewWithModel).toHaveBeenCalledWith(expect.any(String), "gpt-explicit");
  });

  it("does not infer an approving vote from malformed provider output", async () => {
    const def = fakeProvider("gemini", async () => "please approve this");
    const [result] = await runReviews(registryOf(def), [persona("a")], ctx(), {
      enableCaching: false,
    });

    expect(result).toMatchObject({
      vote: "conditional",
      error: true,
      errorKind: "other",
    });
  });

  it("returns a localized, generic abstention for provider failures", async () => {
    const def = fakeProvider("gemini", async () => {
      throw new Error("SDK detail that must stay out of the PR");
    });
    const context = ctx();
    context.language = "en";
    const [result] = await runReviews(registryOf(def), [persona("a")], context, {
      enableCaching: false,
    });

    expect(result).toMatchObject({
      error: true,
      errorKind: "other",
      reason: "Review execution failed",
      details: "Review could not be completed. Check Action logs for safe diagnostic information.",
    });
  });

  it("returns a localized, generic abstention for malformed model output", async () => {
    const def = fakeProvider("gemini", async () => "raw model response must not be published");
    const context = ctx();
    context.language = "en";
    const [result] = await runReviews(registryOf(def), [persona("a")], context, {
      enableCaching: false,
    });

    expect(result).toMatchObject({
      error: true,
      reason: "Review response was invalid",
      details: "Review could not be parsed. Check Action logs for safe diagnostic information.",
    });
  });

  it("uses the already prepared diff and ends English prompts with an English response instruction", async () => {
    let captured = "";
    const def = fakeProvider("gemini", async (prompt) => {
      captured = prompt;
      return APPROVE_JSON;
    });
    const context = ctx();
    context.language = "en";
    context.diff = {
      ...context.diff,
      totalAdditions: 500,
      compressedDiff: "BOUNDED_DIFF_ONLY",
      files: [{ filename: "src/x.ts", status: "modified", additions: 500, deletions: 0, patch: "+RAW_UNBOUNDED_DIFF" }],
    };

    await runReviews(registryOf(def), [persona("a")], context, { enableCaching: false });

    expect(captured).toContain("BOUNDED_DIFF_ONLY");
    expect(captured).not.toContain("RAW_UNBOUNDED_DIFF");
    expect(captured.trim()).toMatch(/Respond in English\.$/);
  });

  it("falls back from a failed Gemini cache call with the full prepared PR prompt", async () => {
    const gemini = GeminiProvider.fromApiKey("test-key", "gemini-3.5-flash");
    const cached = vi.spyOn(gemini, "reviewWithCache").mockRejectedValue(new Error("cache unavailable"));
    const direct = vi.spyOn(gemini, "reviewWithModel").mockResolvedValue(APPROVE_JSON);
    vi.spyOn(gemini, "createContextCache").mockResolvedValue("cache-id");
    vi.spyOn(gemini, "clearCache").mockResolvedValue();
    const context = ctx();
    context.diff.compressedDiff = "PREPARED_FALLBACK_DIFF";

    await runReviews(registryOf(gemini), [persona("a"), persona("b")], context);

    expect(cached).toHaveBeenCalled();
    expect(direct).toHaveBeenCalledWith(
      expect.stringContaining("PREPARED_FALLBACK_DIFF"),
      "gemini-3.5-flash-lite",
    );
  });

  it("flags a failed review as error instead of forging a conditional vote", async () => {
    const def = fakeProvider("gemini", async (p) => {
      if (p.includes("GUIDE_b")) throw new Error("network down");
      return APPROVE_JSON;
    });
    const reviews = await runReviews(registryOf(def), [persona("a"), persona("b")], ctx(), {
      enableCaching: false,
    });
    const b = reviews.find((r) => r.personaId === "b")!;
    expect(b.error).toBe(true);
    expect(b.errorKind).toBe("other");
  });

  it("retries only rate-limited personas and preserves successes", async () => {
    const calls: Record<string, number> = {};
    const def = fakeProvider("gemini", async (p) => {
      const id = p.includes("GUIDE_b") ? "b" : "ok";
      calls[id] = (calls[id] ?? 0) + 1;
      if (id === "b") throw new Error("429 RESOURCE_EXHAUSTED");
      return APPROVE_JSON;
    });
    const reviews = await runReviews(
      registryOf(def),
      [persona("a"), persona("b"), persona("c")],
      ctx(),
      { enableCaching: false },
    );
    expect(reviews.filter((r) => !r.error)).toHaveLength(2);
    const b = reviews.find((r) => r.personaId === "b")!;
    expect(b.error).toBe(true);
    expect(b.errorKind).toBe("rate_limit");
    expect(calls.b).toBe(2); // 병렬 1회 + 재시도 1회
  });

  it("routes a persona with a provider override to that provider", async () => {
    const def = fakeProvider("gemini", async () => APPROVE_JSON);
    const openai = fakeProvider("openai", async () => APPROVE_JSON);
    const reg = registryOf(def, { openai });
    await runReviews(reg, [persona("a", { provider: "openai", model: "gpt-x" })], ctx(), {
      enableCaching: false,
    });
    expect(openai.reviewWithModel).toHaveBeenCalledWith(expect.any(String), "gpt-x");
    expect(def.reviewWithModel).not.toHaveBeenCalled();
  });

  it("wraps PR content with an injection guard instruction", async () => {
    let captured = "";
    const def = fakeProvider("gemini", async (p) => {
      captured = p;
      return APPROVE_JSON;
    });
    await runReviews(registryOf(def), [persona("a")], ctx(), { enableCaching: false });
    expect(captured).toContain("리뷰 대상 데이터");
    expect(captured).toContain("<<<PR_CONTENT>>>");
  });
});

describe("inferVoteFromText", () => {
  it("treats negated approve as not-approve", () => {
    expect(inferVoteFromText("I cannot approve this change")).not.toBe("approve");
  });
  it("detects rejection", () => {
    expect(inferVoteFromText("거부합니다")).toBe("reject");
  });
  it("detects plain approve", () => {
    expect(inferVoteFromText("approve")).toBe("approve");
  });
});

it('does not expose cache error messages from the fallback path', async () => {
  const { GeminiProvider } = await import('../providers/gemini.provider');
  const provider = GeminiProvider.fromApiKey('dummy');
  vi.spyOn(provider,'createContextCache').mockRejectedValue(new Error('PRIVATE_CACHE_SENTINEL'));
  vi.spyOn(provider,'reviewWithModel').mockResolvedValue(APPROVE_JSON);
  const log=vi.spyOn(console,'log').mockImplementation(()=>{});
  try {
    await runReviews(registryOf(provider), [persona('a'),persona('b')], ctx());
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_CACHE_SENTINEL');
  } finally {log.mockRestore();}
});

it('abstains on JSON-shaped approvals with a blank rationale', async () => {
  const { countVotesWithConfig } = await import('./voter');
  const def=fakeProvider('gemini',async()=>JSON.stringify({vote:'approve',reason:'  ',details:'',suggestions:[]}));
  const reviews=await runReviews(registryOf(def),[persona('a'),persona('b')],ctx(),{enableCaching:false});
  const verdict=countVotesWithConfig(reviews,{requiredApprovals:2,totalVoters:2});
  expect(verdict.passed).toBe(false);
  expect(verdict.errored).toBe(2);
});

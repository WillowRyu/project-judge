import { describe, expect, it, vi } from "vitest";
import { runReviews, inferVoteFromText } from "./orchestrator";
import type { PRContext } from "./orchestrator";
import type { ProviderRegistry } from "../providers";
import type { LLMProvider } from "../providers/provider.interface";
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

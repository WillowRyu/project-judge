import { describe, expect, it, vi } from "vitest";
import { runDebate, needsDebate } from "./debate";
import type { DebateConfig } from "./debate";
import type { PRContext } from "./orchestrator";
import type { ProviderRegistry } from "../providers";
import type { LLMProvider } from "../providers/provider.interface";
import type { Persona, ReviewResult } from "../personas/persona.interface";

const APPROVE_DEBATE_JSON =
  '```json\n{"response":"동의합니다","changedVote":null,"newReason":null}\n```';

function persona(id: string, over: Partial<Persona> = {}): Persona {
  return {
    id,
    name: id.toUpperCase(),
    emoji: "🤖",
    role: "R",
    guideline: `GUIDE_${id}`,
    ...over,
  };
}

function review(id: string, over: Partial<ReviewResult> = {}): ReviewResult {
  return {
    personaId: id,
    personaName: id.toUpperCase(),
    personaEmoji: "🤖",
    vote: "approve",
    reason: `reason_${id}`,
    details: `details_${id}`,
    suggestions: [],
    ...over,
  };
}

function ctx(): PRContext {
  return {
    title: "t",
    body: "b",
    author: "a",
    baseBranch: "main",
    headBranch: "f",
    diff: {
      summary: "s",
      files: [],
      totalAdditions: 5,
      totalDeletions: 1,
      compressedDiff: "@@\n+x",
    },
  };
}

function fakeProvider(
  name: string,
  fn: (prompt: string, model: string) => Promise<string>,
): LLMProvider {
  return {
    name,
    review: vi.fn((p: string) => fn(p, "default")),
    reviewWithModel: vi.fn((p: string, m: string) => fn(p, m)),
    getDefaultModel: () => `${name}-default`,
  };
}

function registryOf(
  def: LLMProvider,
  others: Record<string, LLMProvider> = {},
): ProviderRegistry {
  return {
    defaultType: "gemini",
    default: def,
    get: (t) => others[t] ?? def,
    has: () => true,
  };
}

const debateConfig = (over: Partial<DebateConfig> = {}): DebateConfig => ({
  enabled: true,
  maxRounds: 1,
  trigger: "always",
  revoteAfterDebate: true,
  ...over,
});

describe("runDebate with errored personas", () => {
  it("does not throw and leaves an errored persona untouched even if its provider throws", async () => {
    // 'b' is errored; its provider is STILL down and throws on any call.
    // If runDebate calls it, the throw would propagate and crash the whole run.
    const def = fakeProvider("gemini", async () => APPROVE_DEBATE_JSON);
    const downProvider: LLMProvider = {
      name: "openai",
      review: vi.fn(async () => {
        throw new Error("provider still down");
      }),
      reviewWithModel: vi.fn(async () => {
        throw new Error("provider still down");
      }),
      getDefaultModel: () => "openai-default",
    };

    const personas = [
      persona("a"),
      persona("b", { provider: "openai" }),
      persona("c"),
    ];
    const reviews = [
      review("a", { vote: "approve" }),
      review("b", { vote: "conditional", error: true, errorKind: "other" }),
      review("c", { vote: "reject" }),
    ];

    const result = await runDebate(
      registryOf(def, { openai: downProvider }),
      personas,
      reviews,
      ctx(),
      debateConfig(),
    );

    // errored persona unchanged: still error, no debateResponse, no vote change
    const b = result.find((r) => r.personaId === "b")!;
    expect(b.error).toBe(true);
    expect(b.vote).toBe("conditional");
    expect(b.debateResponse).toBeUndefined();
    expect(b.originalVote).toBeUndefined();

    // valid personas were processed
    const a = result.find((r) => r.personaId === "a")!;
    const c = result.find((r) => r.personaId === "c")!;
    expect(a.debateResponse).toBeDefined();
    expect(c.debateResponse).toBeDefined();
  });

  it("does not throw when a NON-errored persona's provider fails, and other personas still debate", async () => {
    // 'a' is NOT errored, so it is not skipped: its provider IS invoked.
    // The provider throws -> the per-persona try/catch must swallow it,
    // keep 'a''s original review, and let the other valid personas debate.
    const def = fakeProvider(
      "gemini",
      async () =>
        '```json\n{"response":"재고하겠습니다","changedVote":"approve","newReason":"설득됨"}\n```',
    );
    const downProvider: LLMProvider = {
      name: "openai",
      review: vi.fn(async () => {
        throw new Error("provider down during debate");
      }),
      reviewWithModel: vi.fn(async () => {
        throw new Error("provider down during debate");
      }),
      getDefaultModel: () => "openai-default",
    };

    const personas = [
      persona("a", { provider: "openai" }),
      persona("b"),
      persona("c"),
    ];
    // Disagreeing votes so needsDebate triggers under trigger:"disagreement".
    // None is errored.
    const reviews = [
      review("a", { vote: "approve" }),
      review("b", { vote: "reject" }),
      review("c", { vote: "conditional" }),
    ];

    // (a) resolves without throwing
    const result = await runDebate(
      registryOf(def, { openai: downProvider }),
      personas,
      reviews,
      ctx(),
      debateConfig({ trigger: "disagreement" }),
    );
    expect(result).toBeDefined();

    // 'a''s provider was actually invoked (it is non-errored, not skipped)
    expect(downProvider.review).toHaveBeenCalledTimes(1);

    // (b) 'a' unchanged: no debateResponse, no originalVote, vote intact
    const a = result.find((r) => r.personaId === "a")!;
    expect(a.vote).toBe("approve");
    expect(a.debateResponse).toBeUndefined();
    expect(a.originalVote).toBeUndefined();

    // (c) at least one OTHER valid persona still got processed
    const b = result.find((r) => r.personaId === "b")!;
    const c = result.find((r) => r.personaId === "c")!;
    expect(b.debateResponse).toBeDefined();
    expect(c.debateResponse).toBeDefined();
    // 'b' actually changed its vote via the default provider's response
    expect(b.vote).toBe("approve");
    expect(b.originalVote).toBe("reject");
  });

  it("never calls the errored persona's provider", async () => {
    const bReview = vi.fn(async () => APPROVE_DEBATE_JSON);
    const bProvider: LLMProvider = {
      name: "openai",
      review: bReview,
      reviewWithModel: vi.fn(async () => APPROVE_DEBATE_JSON),
      getDefaultModel: () => "openai-default",
    };
    const def = fakeProvider("gemini", async () => APPROVE_DEBATE_JSON);

    const personas = [
      persona("a"),
      persona("b", { provider: "openai" }),
    ];
    const reviews = [
      review("a", { vote: "approve" }),
      review("b", { vote: "reject", error: true, errorKind: "rate_limit" }),
    ];

    await runDebate(
      registryOf(def, { openai: bProvider }),
      personas,
      reviews,
      ctx(),
      debateConfig(),
    );

    expect(bReview).not.toHaveBeenCalled();
    expect(bProvider.reviewWithModel).not.toHaveBeenCalled();
  });
});

describe("needsDebate", () => {
  it("returns false when fewer than 2 non-errored reviews exist", () => {
    const reviews = [
      review("a", { vote: "approve" }),
      review("b", { vote: "reject", error: true }),
      review("c", { vote: "conditional", error: true }),
    ];
    // trigger "always" would normally debate, but <2 valid reviews => no debate
    expect(needsDebate(reviews, debateConfig({ trigger: "always" }))).toBe(false);
    expect(needsDebate(reviews, debateConfig({ trigger: "conflict" }))).toBe(
      false,
    );
    expect(needsDebate(reviews, debateConfig({ trigger: "disagreement" }))).toBe(
      false,
    );
  });

  it("ignores errored reviews when computing conflict", () => {
    // valid reviews are both approve => no conflict; the errored reject must not count
    const reviews = [
      review("a", { vote: "approve" }),
      review("b", { vote: "approve" }),
      review("c", { vote: "reject", error: true }),
    ];
    expect(needsDebate(reviews, debateConfig({ trigger: "conflict" }))).toBe(
      false,
    );
  });

  it("debates on 'always' when 2+ valid reviews exist", () => {
    const reviews = [
      review("a", { vote: "approve" }),
      review("b", { vote: "approve" }),
    ];
    expect(needsDebate(reviews, debateConfig({ trigger: "always" }))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { countVotesWithConfig, countVotes, getVoteResultString } from "./voter";
import type { ReviewResult } from "../personas/persona.interface";

function r(vote: ReviewResult["vote"], extra: Partial<ReviewResult> = {}): ReviewResult {
  return {
    personaId: "p",
    personaName: "P",
    personaEmoji: "🤖",
    vote,
    reason: "",
    details: "",
    suggestions: [],
    ...extra,
  };
}

describe("countVotesWithConfig", () => {
  it("excludes errored reviews from the tally", () => {
    const s = countVotesWithConfig(
      [r("approve"), r("approve"), r("conditional", { error: true, errorKind: "other" })],
      { requiredApprovals: 2, totalVoters: 3 },
    );
    expect(s.approvals).toBe(2);
    expect(s.errored).toBe(1);
    expect(s.validVoters).toBe(2);
    expect(s.undetermined).toBe(false);
    expect(s.passed).toBe(true);
  });

  it("marks undetermined when valid reviews are below required approvals", () => {
    const s = countVotesWithConfig(
      [r("approve"), r("conditional", { error: true }), r("conditional", { error: true })],
      { requiredApprovals: 2, totalVoters: 3 },
    );
    expect(s.validVoters).toBe(1);
    expect(s.undetermined).toBe(true);
    expect(s.passed).toBe(false);
  });

  it("counts conditional as half a vote", () => {
    const s = countVotesWithConfig(
      [r("approve"), r("conditional"), r("conditional")],
      { requiredApprovals: 2, totalVoters: 3 },
    );
    // 1 + 0.5*2 = 2 >= 2
    expect(s.passed).toBe(true);
  });
});

describe("countVotes (default)", () => {
  it("uses 2 required approvals and excludes errors", () => {
    const s = countVotes([r("approve"), r("approve"), r("reject")]);
    expect(s.requiredApprovals).toBe(2);
    expect(s.passed).toBe(true);
  });
});

describe("getVoteResultString", () => {
  it("shows undetermined verdict", () => {
    const s = countVotesWithConfig(
      [r("approve"), r("conditional", { error: true }), r("conditional", { error: true })],
      { requiredApprovals: 2, totalVoters: 3 },
    );
    expect(getVoteResultString(s)).toContain("판정 불가");
  });
});

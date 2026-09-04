import { describe, expect, it } from "vitest";
import { generateComment } from "./comment";
import type { ReviewResult, VotingSummary } from "../personas/persona.interface";

function r(over: Partial<ReviewResult>): ReviewResult {
  return {
    personaId: "m",
    personaName: "MELCHIOR",
    personaEmoji: "🔬",
    vote: "approve",
    reason: "ok",
    details: "",
    suggestions: [],
    ...over,
  };
}

const summary: VotingSummary = {
  totalVoters: 2,
  approvals: 1,
  rejections: 0,
  conditionals: 0,
  errored: 1,
  validVoters: 1,
  undetermined: false,
  passed: false,
  requiredApprovals: 2,
};

describe("generateComment", () => {
  it("renders an errored persona as a failure row instead of a vote", () => {
    const md = generateComment(
      [r({ vote: "approve" }), r({ personaId: "c", personaName: "CASPER", error: true })],
      summary,
    );
    expect(md).toContain("리뷰 실패");
    expect(md).toContain("CASPER");
  });

  it("uses the real repository URL in the footer", () => {
    const md = generateComment([r({})], summary);
    expect(md).toContain("github.com/WillowRyu/project-judge");
    expect(md).not.toContain("your-org");
  });
});

describe('localized and complete review output', () => {
  it('renders English headings and excludes failed votes from the display', () => {
    const md = generateComment([r({error:true, reason:'request failed'})], summary, {style:'detailed', includeActionItems:true, language:'en'});
    expect(md).toContain('MAGI review results');
    expect(md).toContain('Review failed');
    expect(md).not.toContain('리뷰 실패');
  });
  it('makes incomplete coverage visible instead of displaying an approval', () => {
    const md = generateComment([r({})], {...summary,passed:false,undetermined:true,incomplete:true}, {style:'summary',includeActionItems:false,language:'en',coverage:{complete:false,totalFiles:2,reviewedFiles:1,omittedFiles:['binary.png'],truncatedFiles:[]}});
    expect(md).toContain('binary.png');
    expect(md).toContain('Incomplete review');
  });
});

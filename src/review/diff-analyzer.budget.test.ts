import { describe, expect, it } from "vitest";
import {
  analyzeDiff,
  estimateTokenCount,
  type FileDiff,
} from "./diff-analyzer";

describe("analyzeDiff budgets", () => {
  it("bounds the prepared diff and reports truncation without collapsing repeated lines", () => {
    const files: FileDiff[] = [
      {
        filename: "src/repeated.ts",
        status: "modified",
        additions: 30,
        deletions: 0,
        patch: [
          "@@ -1,1 +1,30 @@",
          "+const repeated = true;",
          ...Array.from({ length: 28 }, (_, index) => `+const line${index} = ${index};`),
          "+const repeated = true;",
        ].join("\n"),
      },
    ];

    const analyzed = analyzeDiff(files, {
      maxTotalTokens: 120,
      maxTokensPerFile: 120,
      compress: true,
    });

    expect(estimateTokenCount(analyzed.compressedDiff)).toBeLessThanOrEqual(120);
    expect(analyzed.coverage).toEqual({
      complete: false,
      totalFiles: 1,
      reviewedFiles: 1,
      omittedFiles: [],
      truncatedFiles: ["src/repeated.ts"],
    });
    expect(analyzed.compressedDiff.match(/^\+const repeated = true;$/gm)).toHaveLength(2);
  });

  it("marks files without patches as omitted coverage", () => {
    const analyzed = analyzeDiff([
      {
        filename: "binary.png",
        status: "modified",
        additions: 1,
        deletions: 1,
      },
    ]);

    expect(analyzed.coverage).toEqual({
      complete: false,
      totalFiles: 1,
      reviewedFiles: 0,
      omittedFiles: ["binary.png"],
      truncatedFiles: [],
    });
  });

  it("marks a provider-truncated patch when its observed changes do not match file metadata", () => {
    const analyzed = analyzeDiff([
      {
        filename: "src/truncated.ts",
        status: "modified",
        additions: 4,
        deletions: 2,
        patch: "@@ -1,2 +1,4 @@\n-old\n+new",
      },
    ]);

    expect(analyzed.coverage?.complete).toBe(false);
    expect(analyzed.coverage?.truncatedFiles).toEqual(["src/truncated.ts"]);
  });

  it("enforces the total budget across file separators as well as file bodies", () => {
    const files: FileDiff[] = ["a", "b"].map((name) => ({
      filename: `src/${name}.ts`,
      status: "modified",
      additions: 1,
      deletions: 0,
      patch: `+${name.repeat(120)}`,
    }));
    const analyzed = analyzeDiff(files, {
      maxTotalTokens: 92,
      maxTokensPerFile: 92,
    });

    expect(estimateTokenCount(analyzed.compressedDiff)).toBeLessThanOrEqual(92);
  });

  it("does not count a file as reviewed when no budget remains for its diff", () => {
    const analyzed = analyzeDiff(
      [{ filename: "src/unread.ts", status: "modified", additions: 1, deletions: 0, patch: "+line" }],
      { maxTotalTokens: 1, maxTokensPerFile: 1 },
    );

    expect(analyzed.coverage?.reviewedFiles).toBe(0);
    expect(analyzed.coverage?.truncatedFiles).toEqual(["src/unread.ts"]);
  });

  it("counts changed lines that begin with a file-header prefix inside a hunk", () => {
    const analyzed = analyzeDiff([
      {
        filename: "src/prefix.ts",
        status: "modified",
        additions: 1,
        deletions: 0,
        patch: "@@ -1 +1 @@\n++++legitimateAddedLine",
      },
    ]);

    expect(analyzed.coverage?.complete).toBe(true);
  });
});

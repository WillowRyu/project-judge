import { describe, expect, it, vi } from "vitest";
import { postOrUpdateComment } from "./poster";
import type { GitHubClient } from "./client";
import type { ReviewResult, VotingSummary } from "../personas/persona.interface";

function makeClient(comments: Array<{ id: number; body: string }>) {
  const paginate = vi.fn().mockResolvedValue(comments);
  const updateComment = vi.fn().mockResolvedValue({});
  const createComment = vi.fn().mockResolvedValue({});
  const listComments = vi.fn();
  const client = {
    octokit: {
      rest: { issues: { listComments, updateComment, createComment } },
      paginate,
    },
    owner: "o",
    repo: "r",
  } as unknown as GitHubClient;
  return { client, paginate, updateComment, createComment };
}

const reviews: ReviewResult[] = [];
const summary: VotingSummary = {
  totalVoters: 0,
  approvals: 0,
  rejections: 0,
  conditionals: 0,
  errored: 0,
  validVoters: 0,
  undetermined: false,
  passed: true,
  requiredApprovals: 2,
};

describe("postOrUpdateComment", () => {
  it("updates the existing MAGI comment found on a later page", async () => {
    const marker = "<!-- magi-review-comment -->";
    const many = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, body: `c${i}` }));
    many.push({ id: 999, body: `${marker}\nold` });
    const { client, paginate, updateComment, createComment } = makeClient(many);

    await postOrUpdateComment(client, 42, reviews, summary);

    expect(paginate).toHaveBeenCalledWith(
      client.octokit.rest.issues.listComments,
      expect.objectContaining({ owner: "o", repo: "r", issue_number: 42, per_page: 100 }),
    );
    expect(updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 999 }),
    );
    expect(createComment).not.toHaveBeenCalled();
  });

  it("creates a new comment when no marker exists", async () => {
    const { client, createComment, updateComment } = makeClient([{ id: 1, body: "hi" }]);
    await postOrUpdateComment(client, 42, reviews, summary);
    expect(createComment).toHaveBeenCalledOnce();
    expect(updateComment).not.toHaveBeenCalled();
  });
});

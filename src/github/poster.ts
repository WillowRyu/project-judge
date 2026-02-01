import { GitHubClient } from "./client";
import {
  generateCommentWithMarker,
  getCommentMarker,
  CommentOptions,
} from "./comment";
import { ReviewResult, VotingSummary } from "../personas/persona.interface";

/**
 * PR에 코멘트 작성 (기존 MAGI 코멘트가 있으면 업데이트)
 */
export async function postOrUpdateComment(
  client: GitHubClient,
  prNumber: number,
  reviews: ReviewResult[],
  votingSummary: VotingSummary,
  options?: CommentOptions,
): Promise<void> {
  const marker = getCommentMarker();
  const newCommentBody = generateCommentWithMarker(
    reviews,
    votingSummary,
    options,
  );

  // 기존 MAGI 코멘트 찾기
  const { data: comments } = await client.octokit.rest.issues.listComments({
    owner: client.owner,
    repo: client.repo,
    issue_number: prNumber,
  });

  const existingComment = comments.find((comment) =>
    comment.body?.includes(marker),
  );

  if (existingComment) {
    // 기존 코멘트 업데이트
    await client.octokit.rest.issues.updateComment({
      owner: client.owner,
      repo: client.repo,
      comment_id: existingComment.id,
      body: newCommentBody,
    });
    console.log(`Updated existing MAGI comment (ID: ${existingComment.id})`);
  } else {
    // 새 코멘트 작성
    await client.octokit.rest.issues.createComment({
      owner: client.owner,
      repo: client.repo,
      issue_number: prNumber,
      body: newCommentBody,
    });
    console.log("Created new MAGI comment");
  }
}

import { GitHubClient } from "./client";
import { CommentOptions } from "./comment";
import { ReviewResult, VotingSummary } from "../personas/persona.interface";
/**
 * PR에 코멘트 작성 (기존 MAGI 코멘트가 있으면 업데이트)
 */
export declare function postOrUpdateComment(client: GitHubClient, prNumber: number, reviews: ReviewResult[], votingSummary: VotingSummary, options?: CommentOptions): Promise<void>;
//# sourceMappingURL=poster.d.ts.map
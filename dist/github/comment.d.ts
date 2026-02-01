import { ReviewResult, VotingSummary } from "../personas/persona.interface";
/**
 * Comment Generator
 * PR에 작성할 리뷰 코멘트 마크다운 생성
 */
export interface CommentOptions {
    style: "summary" | "detailed";
    includeActionItems: boolean;
}
/**
 * MAGI 리뷰 결과 코멘트 생성
 */
export declare function generateComment(reviews: ReviewResult[], votingSummary: VotingSummary, options?: CommentOptions): string;
/**
 * 업데이트용 코멘트 마커 생성
 */
export declare function getCommentMarker(): string;
/**
 * 마커가 포함된 코멘트 생성
 */
export declare function generateCommentWithMarker(reviews: ReviewResult[], votingSummary: VotingSummary, options?: CommentOptions): string;
//# sourceMappingURL=comment.d.ts.map
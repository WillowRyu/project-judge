import { GitHubClient } from "./client";
import { VotingSummary } from "../personas/persona.interface";
/**
 * Label Manager
 * PR에 라벨 자동 적용/제거
 */
export interface LabelConfig {
    approved: string;
    rejected: string;
}
/**
 * 리뷰 결과에 따라 라벨 적용
 */
export declare function applyLabels(client: GitHubClient, prNumber: number, votingSummary: VotingSummary, labelConfig?: LabelConfig): Promise<void>;
/**
 * 라벨이 존재하는지 확인하고, 없으면 생성
 */
export declare function ensureLabelsExist(client: GitHubClient, labelConfig?: LabelConfig): Promise<void>;
//# sourceMappingURL=labels.d.ts.map
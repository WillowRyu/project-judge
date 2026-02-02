import { ReviewResult, VotingSummary } from "../personas/persona.interface";
/**
 * Slack Notification Module
 * Slack Webhook을 통한 MAGI Review 결과 알림
 */
export interface SlackNotifyConfig {
    webhookUrl: string;
    notifyOn: "all" | "rejection" | "approval";
}
interface SlackBlock {
    type: string;
    text?: {
        type: string;
        text: string;
        emoji?: boolean;
    };
    elements?: Array<{
        type: string;
        text?: {
            type: string;
            text: string;
            emoji?: boolean;
        };
        url?: string;
    }>;
    fields?: Array<{
        type: string;
        text: string;
    }>;
}
interface SlackMessage {
    blocks: SlackBlock[];
}
/**
 * 알림을 보낼지 여부 결정
 */
export declare function shouldNotify(votingSummary: VotingSummary, notifyOn: "all" | "rejection" | "approval"): boolean;
/**
 * Slack Block Kit 메시지 생성
 */
export declare function buildSlackMessage(prTitle: string, prUrl: string, prNumber: number, reviews: ReviewResult[], votingSummary: VotingSummary, commentUrl?: string): SlackMessage;
/**
 * Slack Webhook으로 메시지 전송
 */
export declare function sendSlackNotification(webhookUrl: string, message: SlackMessage): Promise<void>;
/**
 * MAGI 리뷰 결과를 Slack으로 알림
 */
export declare function notifySlack(config: SlackNotifyConfig, prTitle: string, prUrl: string, prNumber: number, reviews: ReviewResult[], votingSummary: VotingSummary, commentUrl?: string): Promise<boolean>;
export {};
//# sourceMappingURL=slack.d.ts.map
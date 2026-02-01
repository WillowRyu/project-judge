import * as github from "@actions/github";
import { FileDiff } from "../review/diff-analyzer";
/**
 * GitHub Client
 * Octokit 래퍼 - PR 정보 조회 및 조작
 */
export type Octokit = ReturnType<typeof github.getOctokit>;
export interface PullRequestInfo {
    number: number;
    title: string;
    body: string;
    author: string;
    baseBranch: string;
    headBranch: string;
    headSha: string;
}
export interface GitHubClient {
    octokit: Octokit;
    owner: string;
    repo: string;
}
/**
 * GitHub 클라이언트 생성
 */
export declare function createGitHubClient(token: string): GitHubClient;
/**
 * PR 정보 조회
 */
export declare function getPullRequest(client: GitHubClient, prNumber: number): Promise<PullRequestInfo>;
/**
 * PR의 변경 파일 목록 조회
 */
export declare function getPullRequestFiles(client: GitHubClient, prNumber: number): Promise<FileDiff[]>;
/**
 * PR 번호 가져오기 (GitHub Context에서)
 */
export declare function getPullRequestNumber(): number | undefined;
/**
 * GitHub Actions 환경인지 확인
 */
export declare function isGitHubActions(): boolean;
//# sourceMappingURL=client.d.ts.map
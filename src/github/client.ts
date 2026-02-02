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
export function createGitHubClient(token: string): GitHubClient {
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  return { octokit, owner, repo };
}

/**
 * PR 정보 조회
 */
export async function getPullRequest(
  client: GitHubClient,
  prNumber: number,
): Promise<PullRequestInfo> {
  const { data: pr } = await client.octokit.rest.pulls.get({
    owner: client.owner,
    repo: client.repo,
    pull_number: prNumber,
  });

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body || "",
    author: pr.user?.login || "unknown",
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    headSha: pr.head.sha,
  };
}

/**
 * PR의 변경 파일 목록 조회
 */
export async function getPullRequestFiles(
  client: GitHubClient,
  prNumber: number,
): Promise<FileDiff[]> {
  const { data: files } = await client.octokit.rest.pulls.listFiles({
    owner: client.owner,
    repo: client.repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return files.map((file) => ({
    filename: file.filename,
    status: mapFileStatus(file.status),
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch,
  }));
}

/**
 * 파일 상태 매핑
 */
function mapFileStatus(
  status: string,
): "added" | "modified" | "removed" | "renamed" {
  switch (status) {
    case "added":
      return "added";
    case "removed":
      return "removed";
    case "renamed":
      return "renamed";
    default:
      return "modified";
  }
}

/**
 * PR 번호 가져오기 (GitHub Context에서)
 * pull_request 이벤트와 issue_comment 이벤트 모두 지원
 */
export function getPullRequestNumber(): number | undefined {
  // pull_request 이벤트인 경우
  if (github.context.payload.pull_request?.number) {
    return github.context.payload.pull_request.number;
  }
  // issue_comment 이벤트인 경우 (PR에 달린 코멘트)
  if (
    github.context.payload.issue?.pull_request &&
    github.context.payload.issue?.number
  ) {
    return github.context.payload.issue.number;
  }
  return undefined;
}

/**
 * GitHub Actions 환경인지 확인
 */
export function isGitHubActions(): boolean {
  return !!process.env.GITHUB_ACTIONS;
}

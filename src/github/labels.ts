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

const DEFAULT_LABELS: LabelConfig = {
  approved: "magi-approved",
  rejected: "magi-changes-requested",
};

/**
 * 리뷰 결과에 따라 라벨 적용
 */
export async function applyLabels(
  client: GitHubClient,
  prNumber: number,
  votingSummary: VotingSummary,
  labelConfig: LabelConfig = DEFAULT_LABELS,
): Promise<void> {
  const labelsToAdd: string[] = [];
  const labelsToRemove: string[] = [];

  if (votingSummary.passed) {
    labelsToAdd.push(labelConfig.approved);
    labelsToRemove.push(labelConfig.rejected);
  } else {
    labelsToAdd.push(labelConfig.rejected);
    labelsToRemove.push(labelConfig.approved);
  }

  // A failed write must reach the caller so labels_status remains truthful.
  await client.octokit.rest.issues.addLabels({
    owner: client.owner, repo: client.repo, issue_number: prNumber, labels: labelsToAdd,
  });
  for (const name of labelsToRemove) await removeLabel(client, prNumber, name);
}

/**
 * 라벨이 존재하는지 확인하고, 없으면 생성
 */
export async function ensureLabelsExist(
  client: GitHubClient,
  labelConfig: LabelConfig = DEFAULT_LABELS,
): Promise<void> {
  const labels = [
    {
      name: labelConfig.approved,
      color: "0e8a16",
      description: "MAGI system approved this PR",
    },
    {
      name: labelConfig.rejected,
      color: "d93f0b",
      description: "MAGI system requested changes",
    },
  ];

  for (const label of labels) {
    try {
      await client.octokit.rest.issues.getLabel({
        owner: client.owner,
        repo: client.repo,
        name: label.name,
      });
    } catch {
      // 라벨이 없으면 생성
      try {
        await client.octokit.rest.issues.createLabel({
          owner: client.owner,
          repo: client.repo,
          name: label.name,
          color: label.color,
          description: label.description,
        });
        console.log(`Created label: ${label.name}`);
      } catch (createError) {
        console.warn(`Failed to create label ${label.name}: ${createError}`);
      }
    }
  }
}

async function removeLabel(client: GitHubClient, prNumber: number, name: string): Promise<void> {
  try {
    await client.octokit.rest.issues.removeLabel({owner:client.owner,repo:client.repo,issue_number:prNumber,name});
  } catch (error) {
    if ((error as {status?:number}).status !== 404) throw error;
  }
}

/** Clear stale verdicts when the latest revision was not successfully reviewed. */
export async function clearLabels(client: GitHubClient, prNumber: number, config: LabelConfig = DEFAULT_LABELS): Promise<void> {
  const results = await Promise.allSettled([removeLabel(client,prNumber,config.approved), removeLabel(client,prNumber,config.rejected)]);
  const errors = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (errors.length) throw new AggregateError(errors.map(error => error.reason), 'Failed to clear verdict labels');
}

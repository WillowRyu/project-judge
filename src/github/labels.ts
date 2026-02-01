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

  // 라벨 추가
  if (labelsToAdd.length > 0) {
    try {
      await client.octokit.rest.issues.addLabels({
        owner: client.owner,
        repo: client.repo,
        issue_number: prNumber,
        labels: labelsToAdd,
      });
      console.log(`Added labels: ${labelsToAdd.join(", ")}`);
    } catch (error) {
      console.warn(`Failed to add labels: ${error}`);
    }
  }

  // 기존 라벨 제거
  for (const label of labelsToRemove) {
    try {
      await client.octokit.rest.issues.removeLabel({
        owner: client.owner,
        repo: client.repo,
        issue_number: prNumber,
        name: label,
      });
      console.log(`Removed label: ${label}`);
    } catch {
      // 라벨이 없으면 무시
    }
  }
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

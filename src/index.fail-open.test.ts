import { afterEach, describe, expect, it, vi } from "vitest";

type Scenario = {
  commentFails?: boolean;
  ensureLabelsFails?: boolean;
  applyLabelsFails?: boolean;
  slackEnabled?: boolean;
  slackWebhookInput?: string;
  slackWebhookInConfig?: string;
  slackFails?: boolean;
  expectResult?: "approved" | "skipped";
  fileDiffs?: Array<{
    filename: string;
    status: "added" | "modified" | "removed" | "renamed";
    additions: number;
    deletions: number;
    patch?: string;
  }>;
  hardCut?: {
    enabled?: boolean;
    max_changed_files?: number;
    max_changed_lines?: number;
  };
};

type RunResult = {
  setOutput: ReturnType<typeof vi.fn>;
  setFailed: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
  postOrUpdateComment: ReturnType<typeof vi.fn>;
  ensureLabelsExist: ReturnType<typeof vi.fn>;
  applyLabels: ReturnType<typeof vi.fn>;
  notifySlack: ReturnType<typeof vi.fn>;
  runReviews: ReturnType<typeof vi.fn>;
};

function createInputs(scenario: Scenario): Record<string, string> {
  return {
    gemini_api_key: "test-key",
    gcp_project_id: "",
    gcp_location: "us-central1",
    openai_api_key: "",
    anthropic_api_key: "",
    slack_webhook_url: scenario.slackWebhookInput || "",
    config_path: "",
  };
}

async function runActionScenario(scenario: Scenario = {}): Promise<RunResult> {
  vi.resetModules();
  vi.clearAllMocks();

  process.env.GITHUB_TOKEN = "test-github-token";
  process.env.GITHUB_REPOSITORY = "WillowRyu/project-judge";
  process.env.GITHUB_WORKSPACE = process.cwd();

  const outputs = new Map<string, unknown>();
  const setOutput = vi.fn((name: string, value: unknown) => {
    outputs.set(name, value);
  });
  const setFailed = vi.fn();
  const warning = vi.fn();

  const postOrUpdateComment = scenario.commentFails
    ? vi.fn().mockRejectedValue(new Error("comment failed"))
    : vi.fn().mockResolvedValue(undefined);
  const ensureLabelsExist = scenario.ensureLabelsFails
    ? vi.fn().mockRejectedValue(new Error("ensure labels failed"))
    : vi.fn().mockResolvedValue(undefined);
  const applyLabels = scenario.applyLabelsFails
    ? vi.fn().mockRejectedValue(new Error("apply labels failed"))
    : vi.fn().mockResolvedValue(undefined);
  const notifySlack = scenario.slackFails
    ? vi.fn().mockRejectedValue(new Error("slack failed"))
    : vi.fn().mockResolvedValue(true);
  const runReviews = vi.fn().mockResolvedValue([
    {
      personaId: "melchior",
      personaName: "MELCHIOR",
      personaEmoji: "🔬",
      vote: "approve",
      reason: "ok",
      details: "ok",
      suggestions: [],
    },
  ]);

  vi.doMock("@actions/core", () => ({
    getInput: (name: string) => createInputs(scenario)[name] || "",
    setOutput,
    setFailed,
    warning,
  }));

  vi.doMock("./config/loader", () => ({
    loadConfig: vi.fn().mockResolvedValue({
      provider: { type: "gemini" },
      voting: { required_approvals: 2 },
      output: {
        pr_comment: { enabled: true, style: "detailed" },
        labels: { enabled: true, approved: "magi-approved", rejected: "magi-rejected" },
      },
      optimization: scenario.hardCut ? { hard_cut: scenario.hardCut } : {},
      debate: { enabled: false },
      notifications: scenario.slackEnabled
        ? {
            slack: {
              enabled: true,
              webhook_url: scenario.slackWebhookInConfig,
              notify_on: "all",
            },
          }
        : undefined,
      ignore: { files: [], paths: [] },
    }),
  }));

  vi.doMock("./providers", () => ({
    createProvider: vi.fn().mockReturnValue({
      name: "gemini",
      review: vi.fn(),
      reviewWithModel: vi.fn(),
    }),
  }));

  vi.doMock("./personas/loader", () => ({
    loadPersonasFromConfig: vi.fn().mockResolvedValue([
      {
        id: "melchior",
        name: "MELCHIOR",
        emoji: "🔬",
        role: "Scientist",
        guideline: "guideline",
      },
      {
        id: "balthasar",
        name: "BALTHASAR",
        emoji: "👩‍👧",
        role: "Mother",
        guideline: "guideline",
      },
      {
        id: "casper",
        name: "CASPER",
        emoji: "💃",
        role: "Human",
        guideline: "guideline",
      },
    ]),
  }));

  vi.doMock("./github", () => ({
    createGitHubClient: vi.fn().mockReturnValue({}),
    getPullRequestNumber: vi.fn().mockReturnValue(42),
    getPullRequest: vi.fn().mockResolvedValue({
      number: 42,
      title: "test pr",
      body: "body",
      author: "tester",
      baseBranch: "main",
      headBranch: "feature",
      headSha: "abc",
    }),
    getPullRequestFiles: vi
      .fn()
      .mockResolvedValue(
        scenario.fileDiffs || [
          {
            filename: "src/a.ts",
            status: "modified",
            additions: 3,
            deletions: 1,
            patch: "@@ -1 +1 @@\n-old\n+new",
          },
        ],
      ),
    postOrUpdateComment,
    applyLabels,
    ensureLabelsExist,
  }));

  vi.doMock("./review", () => ({
    analyzeDiff: vi.fn().mockReturnValue({
      summary: "- src/a.ts (modified: +3/-1)",
      files: [],
      totalAdditions: 3,
      totalDeletions: 1,
      compressedDiff: "@@ -1 +1 @@\n-old\n+new",
    }),
    filterIgnoredFiles: vi.fn((files: unknown[]) => files),
    runReviews,
    countVotesWithConfig: vi.fn().mockReturnValue({
      totalVoters: 1,
      approvals: 1,
      rejections: 0,
      conditionals: 0,
      passed: true,
      requiredApprovals: 1,
    }),
    runDebate: vi.fn(),
  }));

  vi.doMock("./notifications", () => ({
    notifySlack,
  }));

  await import("./index");

  await vi.waitFor(() => {
    expect(outputs.get("result")).toBe(scenario.expectResult || "approved");
  });

  return {
    setOutput,
    setFailed,
    warning,
    postOrUpdateComment,
    ensureLabelsExist,
    applyLabels,
    notifySlack,
    runReviews,
  };
}

function readOutput(
  setOutputMock: ReturnType<typeof vi.fn>,
  key: string,
): unknown {
  const call = setOutputMock.mock.calls.find(([name]) => name === key);
  return call?.[1];
}

describe("index fail-open post actions", () => {
  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_WORKSPACE;
  });

  it("does not fail the action when comment update fails", async () => {
    const result = await runActionScenario({ commentFails: true });

    expect(result.setFailed).not.toHaveBeenCalled();
    expect(result.postOrUpdateComment).toHaveBeenCalledOnce();
    expect(result.applyLabels).toHaveBeenCalledOnce();
    expect(readOutput(result.setOutput, "comment_status")).toBe("failed");
    expect(readOutput(result.setOutput, "labels_status")).toBe("success");
    expect(readOutput(result.setOutput, "slack_status")).toBe("skipped");
  });

  it("does not fail the action when labels and slack fail", async () => {
    const result = await runActionScenario({
      ensureLabelsFails: true,
      applyLabelsFails: true,
      slackEnabled: true,
      slackWebhookInput: "https://hooks.slack.com/services/test",
      slackFails: true,
    });

    expect(result.setFailed).not.toHaveBeenCalled();
    expect(result.ensureLabelsExist).toHaveBeenCalledOnce();
    expect(result.applyLabels).toHaveBeenCalledOnce();
    expect(result.notifySlack).toHaveBeenCalledOnce();
    expect(readOutput(result.setOutput, "comment_status")).toBe("success");
    expect(readOutput(result.setOutput, "labels_status")).toBe("failed");
    expect(readOutput(result.setOutput, "slack_status")).toBe("failed");
  });

  it("skips review before LLM calls when hard cut threshold is exceeded", async () => {
    const result = await runActionScenario({
      expectResult: "skipped",
      hardCut: {
        enabled: true,
        max_changed_files: 300,
        max_changed_lines: 100000,
      },
      fileDiffs: [
        {
          filename: "src/huge.generated.ts",
          status: "modified",
          additions: 100001,
          deletions: 0,
          patch: "@@ -1 +1 @@\n-old\n+new",
        },
      ],
    });

    expect(result.setFailed).not.toHaveBeenCalled();
    expect(result.runReviews).not.toHaveBeenCalled();
    expect(result.postOrUpdateComment).not.toHaveBeenCalled();
    expect(result.applyLabels).not.toHaveBeenCalled();
    expect(readOutput(result.setOutput, "skip_reason")).toContain(
      "hard_cut_triggered",
    );
    expect(readOutput(result.setOutput, "comment_status")).toBe("skipped");
    expect(readOutput(result.setOutput, "labels_status")).toBe("skipped");
    expect(readOutput(result.setOutput, "slack_status")).toBe("skipped");
  });
});

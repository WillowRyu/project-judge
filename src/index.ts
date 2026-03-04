import * as core from "@actions/core";
import { loadConfig } from "./config/loader";
import { createProvider } from "./providers";
import { loadPersonasFromConfig } from "./personas/loader";
import {
  createGitHubClient,
  getPullRequest,
  getPullRequestFiles,
  getPullRequestNumber,
  postOrUpdateComment,
  applyLabels,
  ensureLabelsExist,
} from "./github";
import {
  analyzeDiff,
  filterIgnoredFiles,
  runReviews,
  countVotesWithConfig,
  PRContext,
  runDebate,
} from "./review";
import { notifySlack } from "./notifications";

/**
 * MAGI Review Action - Main Entry Point
 */
async function run(): Promise<void> {
  try {
    console.log("🏛️ MAGI Review System Starting...\n");

    // 1. 입력값 가져오기
    const geminiApiKey = core.getInput("gemini_api_key");
    const gcpProjectId = core.getInput("gcp_project_id");
    const gcpLocation = core.getInput("gcp_location") || "us-central1";
    const openaiApiKey = core.getInput("openai_api_key");
    const anthropicApiKey = core.getInput("anthropic_api_key");
    const slackWebhookUrl = core.getInput("slack_webhook_url");
    const configPath = core.getInput("config_path");
    const githubToken = process.env.GITHUB_TOKEN;

    // 설정 로드 (provider type 확인용)
    const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
    const config = await loadConfig(workspacePath, configPath);
    const providerType = config.provider?.type || "gemini";

    // 인증 방식 확인 (선택된 provider에 따라)
    const hasValidAuth = (() => {
      switch (providerType) {
        case "openai":
          return !!openaiApiKey;
        case "claude":
          return !!anthropicApiKey;
        case "gemini":
        default:
          return !!geminiApiKey || !!gcpProjectId;
      }
    })();

    if (!hasValidAuth) {
      throw new Error(
        `Missing API key for provider "${providerType}". ` +
          `Required: ${
            providerType === "openai"
              ? "openai_api_key"
              : providerType === "claude"
                ? "anthropic_api_key"
                : "gemini_api_key or gcp_project_id"
          }`,
      );
    }

    const authMode =
      providerType === "gemini" && gcpProjectId ? "GCP Vertex AI" : "API Key";
    console.log(`🔐 Authentication Mode: ${authMode} (${providerType})\n`);

    if (!githubToken) {
      throw new Error(
        "GITHUB_TOKEN is required. Make sure to set permissions for pull-requests: write",
      );
    }

    // 2. PR 번호 확인
    const prNumber = getPullRequestNumber();
    if (!prNumber) {
      throw new Error("This action must be run on a pull_request event");
    }

    console.log(`📋 Reviewing PR #${prNumber}\n`);

    // 3. GitHub 클라이언트 생성
    const githubClient = createGitHubClient(githubToken);

    // 4. 설정은 위에서 이미 로드됨
    console.log("✅ Configuration loaded\n");

    // 5. PR 정보 조회
    const prInfo = await getPullRequest(githubClient, prNumber);
    console.log(`   Title: ${prInfo.title}`);
    console.log(`   Author: ${prInfo.author}`);
    console.log(`   Branch: ${prInfo.headBranch} → ${prInfo.baseBranch}\n`);

    // 6. PR 파일 목록 조회
    let files = await getPullRequestFiles(githubClient, prNumber);
    console.log(`📁 Found ${files.length} changed files\n`);

    // 7. 무시할 파일 필터링
    if (config.ignore?.files || config.ignore?.paths) {
      const ignorePatterns = [
        ...(config.ignore.files || []),
        ...(config.ignore.paths || []),
      ];
      files = filterIgnoredFiles(files, ignorePatterns);
      console.log(`   After filtering: ${files.length} files\n`);
    }

    if (files.length === 0) {
      console.log("⚠️ No files to review after filtering. Skipping review.");
      core.setOutput("result", "skipped");
      core.setOutput("skip_reason", "no_reviewable_files");
      core.setOutput("comment_status", "skipped");
      core.setOutput("labels_status", "skipped");
      core.setOutput("slack_status", "skipped");
      return;
    }

    const totalChangedLines = files.reduce(
      (sum, file) => sum + file.additions + file.deletions,
      0,
    );
    const hardCut = config.optimization?.hard_cut;
    const hardCutEnabled = hardCut?.enabled ?? true;
    const maxChangedFiles = hardCut?.max_changed_files ?? 300;
    const maxChangedLines = hardCut?.max_changed_lines ?? 100000;

    if (
      hardCutEnabled &&
      (files.length > maxChangedFiles || totalChangedLines > maxChangedLines)
    ) {
      const reason = `hard_cut_triggered: files=${files.length}/${maxChangedFiles}, lines=${totalChangedLines}/${maxChangedLines}`;
      core.warning(
        `Skipping review due to hard cut threshold. ${reason}. ` +
          "Split the PR or adjust optimization.hard_cut in magi.yml.",
      );
      core.setOutput("result", "skipped");
      core.setOutput("skip_reason", reason);
      core.setOutput("comment_status", "skipped");
      core.setOutput("labels_status", "skipped");
      core.setOutput("slack_status", "skipped");
      return;
    }

    // 8. Diff 분석
    const analyzedDiff = analyzeDiff(files);
    console.log(`📊 Diff Analysis:`);
    console.log(`   +${analyzedDiff.totalAdditions} additions`);
    console.log(`   -${analyzedDiff.totalDeletions} deletions\n`);

    // 9. LLM Provider 생성 (provider type에 따라 적절한 API key 사용)
    const apiKeyForProvider = (() => {
      switch (providerType) {
        case "openai":
          return openaiApiKey;
        case "claude":
          return anthropicApiKey;
        case "gemini":
        default:
          return geminiApiKey;
      }
    })();

    const provider = createProvider({
      type: providerType,
      apiKey: apiKeyForProvider || undefined,
      gcpProjectId: gcpProjectId || undefined,
      gcpLocation: gcpLocation,
      model: config.provider?.model,
    });
    console.log(`🤖 Using ${provider.name} provider\n`);

    // 10. 페르소나 로드
    const personas = await loadPersonasFromConfig(
      workspacePath,
      config.personas,
    );
    console.log(`🎭 Loaded ${personas.length} personas:`);
    for (const persona of personas) {
      console.log(`   ${persona.emoji} ${persona.name} (${persona.role})`);
    }
    console.log("");

    // 11. PR 컨텍스트 생성
    const prContext: PRContext = {
      title: prInfo.title,
      body: prInfo.body,
      diff: analyzedDiff,
      author: prInfo.author,
      baseBranch: prInfo.baseBranch,
      headBranch: prInfo.headBranch,
    };

    // 12. 리뷰 실행 (토큰 최적화 옵션 적용)
    console.log("🔍 Running reviews...\n");
    let reviews = await runReviews(provider, personas, prContext, {
      enableCaching: config.optimization?.context_caching ?? true,
      enableCompression: config.optimization?.prompt_compression ?? true,
      tieredModels: config.optimization?.tiered_models,
    });

    // 12-1. 토론 실행 (설정에 따라)
    if (config.debate?.enabled) {
      reviews = await runDebate(provider, personas, reviews, prContext, {
        enabled: config.debate.enabled,
        maxRounds: config.debate.max_rounds ?? 1,
        trigger: config.debate.trigger ?? "disagreement",
        revoteAfterDebate: config.debate.revote_after_debate ?? true,
      });
    }

    // 13. 투표 집계
    const votingSummary = countVotesWithConfig(reviews, {
      requiredApprovals: config.voting?.required_approvals || 2,
      totalVoters: personas.length,
    });

    console.log("\n📊 Voting Results:");
    console.log(`   Approvals: ${votingSummary.approvals}`);
    console.log(`   Rejections: ${votingSummary.rejections}`);
    console.log(`   Conditionals: ${votingSummary.conditionals}`);
    console.log(
      `   Result: ${votingSummary.passed ? "✅ PASSED" : "❌ FAILED"}\n`,
    );

    let commentStatus: "success" | "failed" | "skipped" = "skipped";
    let labelsStatus: "success" | "failed" | "skipped" = "skipped";
    let slackStatus: "success" | "failed" | "skipped" = "skipped";

    // 14. 라벨 준비
    if (config.output?.labels?.enabled !== false) {
      try {
        await ensureLabelsExist(githubClient, {
          approved: config.output?.labels?.approved || "magi-approved",
          rejected:
            config.output?.labels?.rejected || "magi-changes-requested",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        core.warning(`Failed to ensure labels exist: ${message}`);
      }
    }

    // 15. PR 코멘트 작성
    if (config.output?.pr_comment?.enabled !== false) {
      try {
        await postOrUpdateComment(
          githubClient,
          prNumber,
          reviews,
          votingSummary,
          {
            style: config.output?.pr_comment?.style || "detailed",
            includeActionItems: true,
          },
        );
        commentStatus = "success";
        console.log("💬 Posted review comment to PR\n");
      } catch (error) {
        commentStatus = "failed";
        const message = error instanceof Error ? error.message : String(error);
        core.warning(`Failed to post review comment: ${message}`);
      }
    }

    // 16. 라벨 적용
    if (config.output?.labels?.enabled !== false) {
      try {
        await applyLabels(githubClient, prNumber, votingSummary, {
          approved: config.output?.labels?.approved || "magi-approved",
          rejected:
            config.output?.labels?.rejected || "magi-changes-requested",
        });
        labelsStatus = "success";
        console.log("🏷️ Applied labels\n");
      } catch (error) {
        labelsStatus = "failed";
        const message = error instanceof Error ? error.message : String(error);
        core.warning(`Failed to apply labels: ${message}`);
      }
    }

    // 17. Slack 알림 (설정에 따라)
    const slackConfig = config.notifications?.slack;
    const webhookUrl = slackWebhookUrl || slackConfig?.webhook_url;

    if (slackConfig?.enabled && webhookUrl) {
      try {
        const prUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/pull/${prNumber}`;
        await notifySlack(
          {
            webhookUrl,
            notifyOn: slackConfig.notify_on || "all",
          },
          prInfo.title,
          prUrl,
          prNumber,
          reviews,
          votingSummary,
        );
        slackStatus = "success";
      } catch (slackError) {
        slackStatus = "failed";
        // Slack 에러는 전체 액션 실패로 이어지지 않도록 경고만 출력
        const message =
          slackError instanceof Error ? slackError.message : String(slackError);
        core.warning(`Slack notification failed: ${message}`);
      }
    } else if (slackConfig?.enabled && !webhookUrl) {
      slackStatus = "failed";
      core.warning(
        "Slack notification is enabled, but no webhook URL was provided.",
      );
    }

    // 17. 출력 설정
    core.setOutput("result", votingSummary.passed ? "approved" : "rejected");
    core.setOutput(
      "votes",
      JSON.stringify(
        reviews.map((r) => ({
          persona: r.personaName,
          vote: r.vote,
          reason: r.reason,
        })),
      ),
    );
    core.setOutput("comment_status", commentStatus);
    core.setOutput("labels_status", labelsStatus);
    core.setOutput("slack_status", slackStatus);

    console.log("🏛️ MAGI Review Complete!\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`MAGI Review failed: ${message}`);
  }
}

run();

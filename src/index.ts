import * as core from "@actions/core";
import { loadConfig } from "./config/loader";
import {
  createProviderRegistry,
  hasCredentials,
  ProviderType,
} from "./providers";
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

    // 자격증명 수집
    const credentials = {
      geminiApiKey: geminiApiKey || undefined,
      gcpProjectId: gcpProjectId || undefined,
      gcpLocation: gcpLocation || undefined,
      openaiApiKey: openaiApiKey || undefined,
      anthropicApiKey: anthropicApiKey || undefined,
    };

    // 전역 + 페르소나별 provider가 요구하는 모든 자격증명 검증
    const requiredTypes = new Set<ProviderType>([providerType as ProviderType]);
    for (const p of config.personas ?? []) {
      if (p.provider) requiredTypes.add(p.provider);
    }
    for (const type of requiredTypes) {
      if (!hasCredentials(type, credentials)) {
        const keyHint =
          type === "openai"
            ? "openai_api_key"
            : type === "claude"
              ? "anthropic_api_key"
              : "gemini_api_key or gcp_project_id";
        throw new Error(
          `Missing API key for provider "${type}". Required: ${keyHint}`,
        );
      }
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

    // 9. LLM Provider 레지스트리 생성
    const registry = createProviderRegistry(
      credentials,
      providerType as ProviderType,
      config.provider?.model,
    );
    console.log(`🤖 Using ${registry.default.name} provider (default)\n`);

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
    let reviews = await runReviews(registry, personas, prContext, {
      enableCaching: config.optimization?.context_caching ?? true,
      enableCompression: config.optimization?.prompt_compression ?? true,
      tieredModels: config.optimization?.tiered_models,
    });

    // 12-1. 토론 실행 (설정에 따라)
    if (config.debate?.enabled) {
      reviews = await runDebate(registry, personas, reviews, prContext, {
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
    if (!votingSummary.undetermined && config.output?.labels?.enabled !== false) {
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
    const resultOutput = votingSummary.undetermined
      ? "error"
      : votingSummary.passed
        ? "approved"
        : "rejected";
    core.setOutput("result", resultOutput);
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

    if (votingSummary.undetermined) {
      core.setFailed(
        `리뷰 실패로 정족수 미달: 유효 ${votingSummary.validVoters}표 < 필요 ${votingSummary.requiredApprovals}표 (${votingSummary.errored}개 리뷰 실패). 일시적 오류일 수 있으니 재실행하세요.`,
      );
    }

    console.log("🏛️ MAGI Review Complete!\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`MAGI Review failed: ${message}`);
  }
}

run();

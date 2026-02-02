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

    // 14. 라벨 준비
    if (config.output?.labels?.enabled !== false) {
      await ensureLabelsExist(githubClient, {
        approved: config.output?.labels?.approved || "magi-approved",
        rejected: config.output?.labels?.rejected || "magi-changes-requested",
      });
    }

    // 15. PR 코멘트 작성
    if (config.output?.pr_comment?.enabled !== false) {
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
      console.log("💬 Posted review comment to PR\n");
    }

    // 16. 라벨 적용
    if (config.output?.labels?.enabled !== false) {
      await applyLabels(githubClient, prNumber, votingSummary, {
        approved: config.output?.labels?.approved || "magi-approved",
        rejected: config.output?.labels?.rejected || "magi-changes-requested",
      });
      console.log("🏷️ Applied labels\n");
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

    console.log("🏛️ MAGI Review Complete!\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`MAGI Review failed: ${message}`);
  }
}

run();

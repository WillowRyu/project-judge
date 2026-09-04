import * as core from '@actions/core';
import { loadConfig } from './config/loader';
import type { MagiConfig } from './config/schema';
import { createProviderRegistry, hasCredentials, ProviderType } from './providers';
import { loadPersonasFromConfig } from './personas/loader';
import { createGitHubClient, getPullRequest, getPullRequestFiles, getPullRequestNumber, postOrUpdateComment, applyLabels, clearLabels, ensureLabelsExist, GitHubClient } from './github';
import { authorizeReviewEvent, prepareTrustedWorkspace } from './github/security';
import { analyzeDiff, filterIgnoredFiles, runReviews, countVotesWithConfig, PRContext, runDebate } from './review';
import { notifySlack } from './notifications';

type PublishStatus = 'success' | 'failed' | 'skipped';

async function run(): Promise<void> {
  let cleanup: (() => void) | undefined;
  let client: GitHubClient | undefined;
  let prNumber: number | undefined;
  let config: MagiConfig | undefined;
  let authorized = false;
  let labelsCleared = false;
  let commentStatus: PublishStatus = 'skipped';
  let labelsStatus: PublishStatus = 'skipped';
  let slackStatus: PublishStatus = 'skipped';
  const writeStatuses = () => {
    core.setOutput('comment_status', commentStatus);
    core.setOutput('labels_status', labelsStatus);
    core.setOutput('slack_status', slackStatus);
  };
  const labelConfig = () => ({ approved: config?.output.labels.approved ?? 'magi-approved', rejected: config?.output.labels.rejected ?? 'magi-changes-requested' });
  const clearVerdict = async () => {
    if (!authorized || !client || !prNumber || config?.output.labels.enabled === false || labelsCleared) return;
    try {
      await clearLabels(client, prNumber, labelConfig());
      labelsCleared = true;
    } catch (error) {
      labelsStatus = 'failed';
      core.warning(`Could not clear stale verdict labels: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const skip = async (reason: string, clear = true) => {
    if (clear) await clearVerdict();
    core.setOutput('result', 'skipped');
    core.setOutput('skip_reason', reason);
    writeStatuses();
  };
  try {
    core.setOutput('votes', '[]');
    core.setOutput('coverage', '{}');
    core.setOutput('skip_reason', '');
    core.setOutput('reviewed_head_sha', '');
    writeStatuses();
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) throw new Error('GITHUB_TOKEN is required with contents: read and pull-requests: write.');
    prNumber = getPullRequestNumber();
    if (!prNumber) { await skip('not_pull_request', false); return; }
    client = createGitHubClient(githubToken);
    const skipReason = await authorizeReviewEvent(client);
    if (skipReason) { await skip(skipReason, false); return; }
    authorized = true;

    const prInfo = await getPullRequest(client, prNumber);
    const snapshot = await prepareTrustedWorkspace(client, prInfo.baseSha, core.getInput('config_path'));
    cleanup = snapshot.cleanup;
    config = await loadConfig(snapshot.workspacePath, core.getInput('config_path') || undefined);
    const language = config.output.language;
    core.setOutput('reviewed_head_sha', prInfo.headSha);
    console.log(`Reviewing PR #${prNumber} at ${prInfo.headSha}; policy from ${prInfo.baseSha}`);

    let files = await getPullRequestFiles(client, prNumber);
    // GitHub caps listFiles at 3,000. Check before exclusions can hide omissions.
    if (!Number.isInteger(prInfo.changedFiles) || files.length !== prInfo.changedFiles) {
      core.setOutput('coverage', JSON.stringify({
        complete: false, totalFiles: prInfo.changedFiles, reviewedFiles: 0,
        omittedFiles: [], truncatedFiles: [],
        unavailableFiles: Math.max(0, prInfo.changedFiles - files.length),
      }));
      throw new Error(`Incomplete GitHub file listing: fetched ${files.length} of ${prInfo.changedFiles} changed files. Split the PR or rerun if it changed during retrieval.`);
    }
    files = filterIgnoredFiles(files, [...(config.ignore?.files ?? []), ...(config.ignore?.paths ?? [])]);
    if (files.length === 0) { await skip('no_reviewable_files'); return; }
    const changedLines = files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
    const hardCut = config.optimization.hard_cut;
    if (hardCut.enabled && (files.length > hardCut.max_changed_files || changedLines > hardCut.max_changed_lines)) {
      await skip(`hard_cut_triggered: files=${files.length}/${hardCut.max_changed_files}, lines=${changedLines}/${hardCut.max_changed_lines}`);
      return;
    }
    // Remove any verdict about an earlier revision before reviewing the new one.
    await clearVerdict();
    const diff = analyzeDiff(files, {
      maxTotalTokens: config.optimization.max_diff_tokens,
      maxTokensPerFile: config.optimization.max_tokens_per_file,
      compress: config.optimization.prompt_compression,
    });
    core.setOutput('coverage', JSON.stringify(diff.coverage));
    const personas = await loadPersonasFromConfig(snapshot.workspacePath, config.personas);
    const context: PRContext = { title:prInfo.title, body:prInfo.body, author:prInfo.author, baseBranch:prInfo.baseBranch, headBranch:prInfo.headBranch, diff, language };
    const credentials = {
      geminiApiKey: core.getInput('gemini_api_key') || process.env.GEMINI_API_KEY,
      gcpProjectId: core.getInput('gcp_project_id') || process.env.GCP_PROJECT_ID,
      gcpLocation: core.getInput('gcp_location') || process.env.GCP_LOCATION,
      openaiApiKey: core.getInput('openai_api_key') || process.env.OPENAI_API_KEY,
      anthropicApiKey: core.getInput('anthropic_api_key') || process.env.ANTHROPIC_API_KEY,
    };
    for (const key of [credentials.geminiApiKey, credentials.openaiApiKey, credentials.anthropicApiKey]) if (key) core.setSecret(key);
    const providerType = config.provider.type;
    const requiredTypes = new Set<ProviderType>([providerType, ...personas.map(p => p.provider ?? providerType)]);
    for (const type of requiredTypes) {
      if (!hasCredentials(type, credentials)) throw new Error(`Missing credentials for provider "${type}". Configure its Action API-key input (or GCP project for Gemini).`);
    }
    const registry = createProviderRegistry(credentials, providerType, config.provider.model);
    let reviews = diff.coverage?.reviewedFiles === 0 ? [] : await runReviews(registry, personas, context, {
      enableCaching: config.optimization.context_caching,
      enableCompression: config.optimization.prompt_compression,
      tieredModels: config.optimization.tiered_models,
      defaultModel: config.provider.model,
    });
    if (config.debate.enabled && diff.coverage?.complete !== false) {
      reviews = await runDebate(registry, personas, reviews, context, {
        enabled:true, maxRounds:config.debate.max_rounds, trigger:config.debate.trigger, revoteAfterDebate:config.debate.revote_after_debate,
      });
    }
    const voting = countVotesWithConfig(reviews, {requiredApprovals:config.voting.required_approvals,totalVoters:personas.length});
    if (diff.coverage?.complete === false) {
      voting.incomplete = true;
      voting.undetermined = true;
      voting.passed = false;
    }
    // A newer push must never receive this run's verdict.
    const current = await getPullRequest(client, prNumber);
    if (current.headSha !== prInfo.headSha || current.baseSha !== prInfo.baseSha) { await skip('pull_request_changed_during_review', false); return; }

    if (config.output.pr_comment.enabled) {
      try {
        await postOrUpdateComment(client, prNumber, reviews, voting, {style:config.output.pr_comment.style,includeActionItems:true,language,coverage:diff.coverage,headSha:prInfo.headSha});
        commentStatus = 'success';
      } catch (error) {
        commentStatus = 'failed';
        core.warning(`Comment publication failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!voting.undetermined && config.output.labels.enabled) {
      try {
        try {
          await ensureLabelsExist(client, labelConfig());
        } catch (error) {
          core.warning(`Label setup failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        await applyLabels(client, prNumber, voting, labelConfig());
        labelsStatus = 'success';
      } catch (error) {
        labelsStatus = 'failed';
        core.warning(`Label publication failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const slack = config.notifications?.slack;
    const webhookUrl = core.getInput('slack_webhook_url') || slack?.webhook_url;
    if (slack?.enabled) {
      if (webhookUrl) {
        core.setSecret(webhookUrl);
        try {
          const prUrl = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${client.owner}/${client.repo}/pull/${prNumber}`;
          const sent = await notifySlack({webhookUrl,notifyOn:slack.notify_on,language},prInfo.title,prUrl,prNumber,reviews,voting);
          slackStatus = sent ? 'success' : 'skipped';
        } catch (error) {
          slackStatus = 'failed';
          core.warning(`Slack notification failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        slackStatus = 'failed';
        core.warning('Slack is enabled but slack_webhook_url was not provided.');
      }
    }
    core.setOutput('votes', JSON.stringify(reviews.map(r => ({persona:r.personaName,vote:r.error ? 'abstain' : r.vote,error:!!r.error,reason:r.reason}))));
    core.setOutput('result', voting.undetermined ? 'error' : voting.passed ? 'approved' : 'rejected');
    writeStatuses();
    if (voting.incomplete) {
      core.setFailed(language === 'en' ? 'Review coverage is incomplete. Split the PR, provide missing patches, or increase the diff budget.' : '검토 범위가 불완전합니다. PR을 나누거나 누락된 diff를 확인하고 토큰 예산을 조정하세요.');
    } else if (voting.undetermined) {
      core.setFailed(`Insufficient valid reviews: ${voting.validVoters}/${voting.requiredApprovals} required (${voting.errored} failed).`);
    } else if (!voting.passed && config.voting.fail_on_rejection) {
      core.setFailed(language === 'en' ? 'MAGI requested changes.' : 'MAGI가 변경을 요청했습니다.');
    }
  } catch (error) {
    await clearVerdict();
    core.setOutput('result', 'error');
    writeStatuses();
    core.setFailed(`MAGI Review failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    cleanup?.();
  }
}

void run();

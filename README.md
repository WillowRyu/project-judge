# MAGI Review

A GitHub Action that reviews pull requests with several AI reviewers, then aggregates their votes. Gemini, OpenAI (Responses API), and Claude are supported, including a different provider per reviewer.

[한국어 문서](README_KO.md)

## Quick start

1. Add the provider API key to your repository's Actions secrets.
2. Merge `.github/magi.yml` into the PR's **base branch**. The Action deliberately reads configuration and guidelines from the immutable base commit, never from PR-controlled files.
3. Add the workflow below. Replace `REVIEWED_COMMIT_SHA` with the full commit SHA of the version you have reviewed and pushed. This repository does not yet publish a stable release tag; do not use a moving `@main` ref in production.

```yaml
name: MAGI Review
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
  issue_comment:
    types: [created]
permissions:
  contents: read
  pull-requests: write
  issues: write
concurrency:
  group: magi-${{ github.event.pull_request.number || github.event.issue.number }}
  cancel-in-progress: true
jobs:
  review:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    if: >-
      github.event_name == 'pull_request' ||
      (github.event.issue.pull_request && github.event.comment.body == '/magi-review')
    steps:
      - uses: WillowRyu/project-judge@REVIEWED_COMMIT_SHA
        id: magi
        with:
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**No checkout step is needed.** `/magi-review` must be the whole comment. The Action verifies the comment author's repository write/maintain/admin permission through GitHub before reading policy or calling a model. Fork `pull_request` runs return `skipped` because provider secrets are unavailable; a maintainer can request a review by commenting `/magi-review` on the fork PR. Unsupported events and unauthorized comments do not publish or consume provider credits.

## Providers and models

```yaml
version: 1
provider:
  type: openai                 # gemini | openai | claude
  model: gpt-5.5               # optional; an explicit model is respected
output:
  language: en                # ko (default) | en
```

Use `openai_api_key` or `anthropic_api_key` instead of `gemini_api_key` in the workflow for those providers. API keys may also be supplied as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` environment variables. `GITHUB_TOKEN` is required.

| Provider | Default |
|---|---|
| Gemini | `gemini-3.5-flash`; automatic small tier uses `gemini-3.5-flash-lite` |
| OpenAI | `gpt-5.5`, using Responses API with `store: false` |
| Claude | `claude-sonnet-5` |

Model precedence is **reviewer model → explicit global model → explicitly configured tier → provider default/automatic Gemini tier**. A reviewer using a different provider uses that provider's own default unless it has a model override. Automatic Gemini tiers are small (≤10 changed lines), medium (11–100), and large (>100). Medium and large use the supported stable Flash baseline; choose another supported model explicitly if needed. Model names are configurable so upgrades do not require changing source.

For Vertex AI, authenticate with Application Default Credentials (for example Workload Identity Federation), then pass `gcp_project_id`. `gcp_location` is an optional explicit override and is always respected; otherwise the Action chooses the model's default location. When configuring multiple providers, supply every required key. Global provider credentials are also required.

## Configuration

Automatic discovery, in order: `.github/magi.yml`, `.github/magi.yaml`, `.magi.yml`, `.magi.yaml`. Use the `config_path` input for a different repository-relative path. A missing explicit file, unknown setting, invalid vote threshold, or unsafe file path is an error rather than silent fallback. All policy files must resolve inside the trusted root; symlinks to external files are rejected.

```yaml
version: 1
provider:
  type: gemini
voting:
  required_approvals: 2
  fail_on_rejection: false
personas:
  - id: security
  - id: backend
  - id: frontend
optimization:
  context_caching: true
  prompt_compression: true
  max_diff_tokens: 30000
  max_tokens_per_file: 2500
  # Optional explicit models by diff size:
  # tiered_models:
  #   small: gemini-3.5-flash-lite
  #   medium: gemini-3.5-flash
  #   large: gemini-3.5-flash
  hard_cut:
    enabled: true
    max_changed_files: 300
    max_changed_lines: 100000
debate:
  enabled: false
  max_rounds: 1               # 1–5
  trigger: disagreement       # conflict | disagreement | always
  revote_after_debate: true
output:
  language: en
  pr_comment:
    enabled: true
    style: detailed           # summary | detailed
  labels:
    enabled: true
    approved: magi-approved
    rejected: magi-changes-requested
ignore:
  use_defaults: true
  files: ['*.lock']
  paths: ['vendor/']
notifications:
  slack:
    enabled: false
    notify_on: all             # all | rejection | approval
```

An `approve` contributes 1 vote and a valid `conditional` contributes 0.5. Failed, empty, malformed, or truncated responses abstain and never contribute. `required_approvals` must be a positive integer no larger than the reviewer count. Legacy `total_voters`, if supplied, must match that count.

A rejection is nonblocking by default. Set `voting.fail_on_rejection: true` to fail the Action check for `rejected`; the output still remains `rejected`. A review with too few valid responses or incomplete code coverage returns `error` and fails the check. For branch protection, require the appropriate PR workflow check; a comment-triggered run is not a check attached to the PR head.

## Reviewers and team guidelines

The default reviewers remain MELCHIOR (technical correctness), BALTHASAR (maintainability), and CASPER (user experience). Neutral builtins are `security`, `backend`, and `frontend`.

```yaml
personas:
  - id: security
    name: Security reviewer
    role: Application security engineer
    provider: openai
    model: gpt-5.5
  - id: backend
    provider: claude
  - id: custom
    name: Domain reviewer
    builtin: false
    guideline_file: docs/review/domain.md
```

Guideline precedence: explicit `guideline_file` → `<id>.md` in `.github/magi/`, `.magi/`, or `docs/magi/` → builtin (unless `builtin: false`). `name`, `emoji`, and `role` override builtin metadata. A shared `common.md` (or `COMMON.md`) in the same search directories is appended once. Reviewer IDs must be unique safe names. Merge policy changes into the base branch before expecting them to affect reviews.

Custom guidelines must request this JSON response contract:

```json
{"vote":"approve","reason":"Brief reason","details":"Review text","suggestions":[]}
```

Allowed votes: `approve`, `reject`, `conditional`. `reason` must be a nonblank string and `details` must be a string; `suggestions` must be an array of strings. The selected output language is supplied by the review and debate prompts.

## Coverage, cost, and outcomes

The Action reviews GitHub's patches, not a full repository checkout. Ignored files are excluded before coverage is calculated. Missing patches, GitHub-truncated patches, and diff-budget truncation are visible in the comment and `coverage` output and prevent approval. An incomplete GitHub file listing also fails before review (the API caps results at 3,000 files), with `coverage.unavailableFiles` reporting the missing count. Split large PRs, adjust exclusions deliberately, or increase the budget to obtain complete coverage.

Diff budgets are conservative **estimates**, not exact billing token counts, and do not include guidelines, PR description, or debate opinions. Three reviewers normally require three model calls; caching, retries, and optional debate can add requests. Disabling `prompt_compression` preserves unchanged patch context but does not disable the budget. Default ignored files include generated artifacts, lockfiles, build outputs, and dependencies; set `ignore.use_defaults: false` to replace that default policy.

| Output | Meaning |
|---|---|
| `result` | `approved`, `rejected`, `skipped`, or `error` |
| `skip_reason` | Empty on normal execution; reason when skipped |
| `votes` | JSON reviewer votes; failures use `vote: "abstain"`, `error: true` |
| `coverage` | JSON with `complete`, `totalFiles`, `reviewedFiles`, `omittedFiles`, `truncatedFiles`; `{}` before diff analysis |
| `reviewed_head_sha` | Commit examined by this run; trust it only with the final `result` |
| `comment_status` | `success`, `failed`, `skipped` |
| `labels_status` | Verdict-label publication status; `failed` also reports cleanup failure |
| `slack_status` | `success`, `failed`, `skipped`; notification filters return `skipped` |

Stale verdict labels are cleared before a new authorized review and on skipped/error results when labels are enabled. If the PR changes while models run, the old result is skipped without publishing a new verdict. Comment or notification failures remain nonblocking and are exposed in their status outputs.

For Slack, set `notifications.slack.enabled: true` and pass `slack_webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}` in the Action inputs. `notify_on: rejection` applies only to determined rejections; `all` also includes errors reported after reviewing.

## Development and migration

```bash
nvm install
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm check:dist
pnpm smoke:dist
pnpm audit
```

Node 24 and the exact pnpm version in `packageManager` are required. `pnpm build` replaces generated `dist/`; include it with source changes. CI checks the bundle, types, tests, and dependency advisories. Dependabot proposes weekly package/Action updates. CI no longer pushes an automatic dist commit after a source merge.

Changes in 0.2: policy now comes from PR base, explicit settings are validated, malformed reviews abstain, incomplete coverage fails, OpenAI uses Responses, and Node 20 is no longer supported. Existing generated-code exclusions and the default Korean/MAGI experience are retained. Configure the neutral presets and English output explicitly. TypeScript 5 and Zod 3 are retained to avoid unrelated major migrations.

## License

MIT

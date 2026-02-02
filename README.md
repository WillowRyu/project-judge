# MAGI Review

🏛️ AI Code Review Bot inspired by Evangelion's MAGI System

Three personas (MELCHIOR, BALTHASAR, CASPER) evaluate PRs from different perspectives.
Approves when **2/3 or more** personas agree.

## 🎭 Personas

| Persona          | Role        | Focus                                            | Personality              |
| ---------------- | ----------- | ------------------------------------------------ | ------------------------ |
| 🔬 **MELCHIOR**  | Scientist   | Code efficiency, algorithms, bugs, security      | Cold and technical       |
| 👩‍👧 **BALTHASAR** | Mother      | Maintainability, readability, conventions, tests | Strict but collaborative |
| 💃 **CASPER**    | Woman/Human | UX/UI consistency, user experience               | Intuitive and emotional  |

## 🚀 Quick Start

Choose from 3 LLM Providers:

| Provider   | Default Model                | Environment Variable                 |
| :--------- | :--------------------------- | :----------------------------------- |
| **Gemini** | `gemini-2.5-flash`           | `GEMINI_API_KEY` or `GCP_PROJECT_ID` |
| **OpenAI** | `gpt-5.2`                    | `OPENAI_API_KEY`                     |
| **Claude** | `claude-sonnet-4-5-20250929` | `ANTHROPIC_API_KEY`                  |

### Option 1: Gemini (Default)

```yaml
- uses: WillowRyu/project-judge@main
  with:
    gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Option 2: OpenAI (GPT-5)

```yaml
- uses: WillowRyu/project-judge@main
  with:
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`.github/magi.yml`:

```yaml
provider:
  type: openai
  model: gpt-5.2 # optional
```

### Option 3: Claude (Anthropic)

```yaml
- uses: WillowRyu/project-judge@main
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`.github/magi.yml`:

```yaml
provider:
  type: claude
  model: claude-sonnet-4-5-20250929 # optional
```

### Option 4: GCP Vertex AI (Enterprise)

```yaml
- uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}

- uses: WillowRyu/project-judge@main
  with:
    gcp_project_id: ${{ secrets.GCP_PROJECT_ID }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Full Workflow Example

`.github/workflows/magi-review.yml`:

```yaml
name: MAGI Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  magi-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: WillowRyu/project-judge@main
        with:
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## ⚙️ Configuration

Customize behavior with `.github/magi.yml`:

```yaml
version: 1

# Provider settings (gemini | openai | claude)
provider:
  type: gemini
  model: gemini-2.5-flash # optional

# Voting settings
voting:
  required_approvals: 2 # Required approval count

# Debate feature
debate:
  enabled: true
  max_rounds: 1
  trigger: disagreement # conflict | disagreement | always

# Output settings
output:
  pr_comment:
    enabled: true
    style: detailed # summary | detailed
  labels:
    enabled: true
    approved: magi-approved
    rejected: magi-changes-requested

# Notifications
notifications:
  slack:
    enabled: true
    notify_on: all # all | rejection | approval

# Ignore files
ignore:
  files:
    - "*.lock"
    - "*.generated.*"
  paths:
    - "node_modules/"
    - "dist/"
```

## 📱 Slack Notifications

Send review results to Slack channel.

### Setup

1. **Create Slack Webhook:**
   - Go to Slack → Apps → "Incoming Webhooks"
   - Select channel and create webhook URL

2. **Add to GitHub Secrets:**
   - Add `SLACK_WEBHOOK_URL` to repository secrets

3. **Update Workflow:**

```yaml
- uses: WillowRyu/project-judge@main
  with:
    gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
    slack_webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

4. **Enable in magi.yml:**

```yaml
notifications:
  slack:
    enabled: true
    notify_on: all # all | rejection | approval
```

### Slack Message Preview

```
🏛️ MAGI Review Result

#42 feat: add user authentication

✅ Approved (2/3, 2 votes required)

🔬 MELCHIOR  ✅ approve
👩‍👧 BALTHASAR ⚠️ conditional
💃 CASPER    ✅ approve

[📋 View PR] [🔍 View Details]
```

## 💬 Debate Feature

When personas disagree, they debate and may change their votes.

### Configuration

```yaml
debate:
  enabled: true
  max_rounds: 1
  trigger: disagreement # conflict | disagreement | always
  revote_after_debate: true
```

### Trigger Options

| Trigger        | Description                             |
| -------------- | --------------------------------------- |
| `conflict`     | Only when both approve and reject exist |
| `disagreement` | When votes are not unanimous            |
| `always`       | Always debate (for testing)             |

### Vote Changes

After debate, vote changes are shown as:

- `❌ reject → ⚠️ conditional`
- `⚠️ conditional → ✅ approve`

## 🎨 Persona Customization

### Per-Persona Provider

Use different LLM providers for each persona:

```yaml
personas:
  - id: melchior
    provider: openai
    model: gpt-5.2-pro
  - id: balthasar
    provider: claude
    model: claude-opus-4-5-20251101
  - id: casper
    provider: gemini
    model: gemini-2.5-flash
```

> **Note:** Provide all required API keys when using per-persona providers.

### Common Guidelines

Create `.github/magi/common.md` to add guidelines for all personas:

```markdown
# Team Guidelines

## Project Context

- This is an e-commerce platform
- PCI DSS compliance required

## Team Conventions

- All APIs follow REST conventions
- Error codes use ERR\_ prefix
```

### Custom Persona Guidelines

Create `.github/magi/melchior.md` to fully customize individual personas.

**Priority:**

1. Custom guideline file (if exists)
2. Built-in default (fallback)
3. \+ common.md (always appended)

## 📊 Output Example

```
## 🏛️ MAGI System Review Result

### ✅ Approved (2/3)

| Persona | Vote | Reason |
|:-------:|:----:|--------|
| 🔬 MELCHIOR | ✅ | Algorithm efficient, no security issues |
| 👩‍👧 BALTHASAR | ❌ reject → ⚠️ conditional | After debate: maintainability concerns addressed |
| 💃 CASPER | ✅ | UX consistency maintained |

<details>
<summary>🔬 MELCHIOR Details</summary>
...
</details>
```

## 📁 Project Structure

```
project-judge/
├── src/
│   ├── index.ts              # Main entry point
│   ├── config/               # Config loader & schema
│   ├── providers/            # LLM Providers (Gemini, OpenAI, Claude)
│   ├── personas/             # Personas & guidelines
│   │   └── built-in/         # Built-in defaults
│   ├── review/               # Review engine
│   ├── notifications/        # Slack notifications
│   └── github/               # GitHub API integration
├── action.yml                # GitHub Action metadata
└── .github/workflows/        # Example workflows
```

## 🔧 Development

```bash
# Install dependencies
pnpm install

# Type check
pnpm typecheck

# Build
pnpm build

# Test
pnpm test
```

## 📝 License

MIT

---

📖 [한국어 문서 (Korean)](./README_KO.md)

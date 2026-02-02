# MAGI Review

🏛️ 에반게리온의 MAGI 시스템을 모티브로 한 AI 코드 리뷰 봇

3개의 페르소나(MELCHIOR, BALTHASAR, CASPER)가 각각 다른 관점에서 PR을 평가하고,
**2/3 이상 찬성** 시 승인합니다.

## 🎭 페르소나

| 페르소나         | 역할      | 리뷰 포커스                        | 성격              |
| ---------------- | --------- | ---------------------------------- | ----------------- |
| 🔬 **MELCHIOR**  | 과학자    | 코드 효율성, 알고리즘, 버그, 보안  | 냉철하고 기술적   |
| 👩‍👧 **BALTHASAR** | 어머니    | 유지보수성, 가독성, 컨벤션, 테스트 | 엄격하지만 협력적 |
| 💃 **CASPER**    | 여자/인간 | UX/UI 일관성, 사용자 경험          | 직관적이고 감성적 |

## 🚀 빠른 시작

3가지 LLM Provider 중 선택:

| Provider   | 기본 모델                    | 환경변수                               |
| :--------- | :--------------------------- | :------------------------------------- |
| **Gemini** | `gemini-2.5-flash`           | `GEMINI_API_KEY` 또는 `GCP_PROJECT_ID` |
| **OpenAI** | `gpt-5.2`                    | `OPENAI_API_KEY`                       |
| **Claude** | `claude-sonnet-4-5-20250929` | `ANTHROPIC_API_KEY`                    |

### Option 1: Gemini (기본)

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

### Option 4: GCP Vertex AI (엔터프라이즈)

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

### 전체 Workflow 예제

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

### 코멘트로 재실행 트리거

PR 생성 시 1회만 실행하고, `/magi-review` 코멘트로 재실행:

`.github/workflows/magi-review.yml`:

```yaml
name: MAGI Review

on:
  pull_request:
    types: [opened] # 처음 생성 시만
  issue_comment:
    types: [created] # 코멘트로 재트리거

permissions:
  contents: read
  pull-requests: write

jobs:
  magi-review:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' && 
       github.event.issue.pull_request &&
       contains(github.event.comment.body, '/magi-review'))

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event_name == 'issue_comment' && format('refs/pull/{0}/head', github.event.issue.number) || '' }}

      - uses: WillowRyu/project-judge@main
        with:
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**사용법:**
| 트리거 | 실행 조건 |
|:-------|:----------|
| PR 생성 | 자동 실행 (1회) |
| 코드 push | ❌ 실행 안 함 |
| `/magi-review` 코멘트 | ✅ 재실행 |

## ⚙️ 설정

`.github/magi.yml` 파일로 동작을 커스터마이징:

```yaml
version: 1

# Provider 설정 (gemini | openai | claude)
provider:
  type: gemini
  model: gemini-2.5-flash # optional

# 투표 설정
voting:
  required_approvals: 2 # 필요한 찬성 수

# 토론 기능
debate:
  enabled: true
  max_rounds: 1
  trigger: disagreement # conflict | disagreement | always

# 출력 설정
output:
  pr_comment:
    enabled: true
    style: detailed # summary | detailed
  labels:
    enabled: true
    approved: magi-approved
    rejected: magi-changes-requested

# 알림 설정
notifications:
  slack:
    enabled: true
    notify_on: all # all | rejection | approval

# 무시할 파일
ignore:
  files:
    - "*.lock"
    - "*.generated.*"
  paths:
    - "node_modules/"
    - "dist/"
```

## 📱 Slack 알림

리뷰 결과를 Slack 채널로 전송합니다.

### 설정 방법

1. **Slack Webhook 생성:**
   - Slack → 앱 → "Incoming Webhooks" 추가
   - 채널 선택 후 Webhook URL 생성

2. **GitHub Secrets 추가:**
   - 저장소 Settings → Secrets에 `SLACK_WEBHOOK_URL` 추가

3. **Workflow 업데이트:**

```yaml
- uses: WillowRyu/project-judge@main
  with:
    gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
    slack_webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

4. **magi.yml 활성화:**

```yaml
notifications:
  slack:
    enabled: true
    notify_on: all # all | rejection | approval
```

### Slack 메시지 미리보기

```
🏛️ MAGI 리뷰 결과

#42 feat: add user authentication

✅ 승인 (2/3, 2표 필요)

🔬 MELCHIOR  ✅ approve
👩‍👧 BALTHASAR ⚠️ conditional
💃 CASPER    ✅ approve

[📋 PR 보기] [🔍 상세 리뷰 보기]
```

## 💬 토론 기능

페르소나들의 의견이 다를 때 토론을 통해 투표를 변경할 수 있습니다.

### 설정

```yaml
debate:
  enabled: true
  max_rounds: 1
  trigger: disagreement # conflict | disagreement | always
  revote_after_debate: true
```

### Trigger 옵션

| Trigger        | 설명                              |
| -------------- | --------------------------------- |
| `conflict`     | approve와 reject가 모두 있을 때만 |
| `disagreement` | 투표가 만장일치가 아닐 때         |
| `always`       | 항상 토론 (테스트용)              |

### 투표 변경 표시

토론 후 투표가 변경되면 다음과 같이 표시됩니다:

- `❌ reject → ⚠️ conditional`
- `⚠️ conditional → ✅ approve`

## 🎨 페르소나 커스터마이징

### 페르소나별 Provider 지정

각 페르소나마다 다른 LLM Provider 사용:

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

> **참고:** 페르소나별 provider 사용 시 해당 API key를 모두 설정해야 합니다.

### 공통 지침 추가

`.github/magi/common.md` 파일로 모든 페르소나에 적용되는 지침 추가:

```markdown
# 팀 지침

## 프로젝트 컨텍스트

- e-commerce 플랫폼
- PCI DSS 규정 준수 필수

## 팀 컨벤션

- 모든 API는 REST 규칙 준수
- 에러 코드는 ERR\_ prefix 사용
```

### 커스텀 페르소나 지침

`.github/magi/melchior.md` 등의 파일로 개별 페르소나를 완전히 커스터마이징.

**우선순위:**

1. 커스텀 지침 파일 (있으면 사용)
2. 내장 기본 지침 (폴백)
3. \+ common.md (항상 추가)

## 📊 출력 예시

```
## 🏛️ MAGI 시스템 리뷰 결과

### ✅ 승인 (2/3)

| 페르소나 | 판정 | 핵심 이유 |
|:-------:|:----:|----------|
| 🔬 MELCHIOR | ✅ | 알고리즘 효율적, 보안 이슈 없음 |
| 👩‍👧 BALTHASAR | ❌ reject → ⚠️ conditional | 토론 후: 유지보수 우려 해소 |
| 💃 CASPER | ✅ | UX 일관성 양호 |

<details>
<summary>🔬 MELCHIOR 상세 리뷰</summary>
...
</details>
```

## 📁 프로젝트 구조

```
project-judge/
├── src/
│   ├── index.ts              # 메인 엔트리포인트
│   ├── config/               # 설정 로더 & 스키마
│   ├── providers/            # LLM Provider (Gemini, OpenAI, Claude)
│   ├── personas/             # 페르소나 & 지침
│   │   └── built-in/         # 내장 기본 지침
│   ├── review/               # 리뷰 엔진
│   ├── notifications/        # Slack 알림
│   └── github/               # GitHub API 연동
├── action.yml                # GitHub Action 메타
└── .github/workflows/        # 예제 워크플로우
```

## 🔧 개발

```bash
# 의존성 설치
pnpm install

# 타입 체크
pnpm typecheck

# 빌드
pnpm build

# 테스트
pnpm test
```

## 📝 라이선스

MIT

---

📖 [English Documentation](./README.md)

# MAGI Review

🏛️ 에반게리온의 MAGI 시스템을 모티브로 한 AI 코드 리뷰 봇

3개의 페르소나(MELCHIOR, BALTHASAR, CASPER)가 각각 다른 관점에서 PR을 평가하고,
**2/3 이상 찬성** 시 승인합니다.

## 🎭 페르소나

| 페르소나         | 역할      | 리뷰 포커스                          | 성격              |
| ---------------- | --------- | ------------------------------------ | ----------------- |
| 🔬 **MELCHIOR**  | 과학자    | 코드 효율성, 알고리즘, 버그, 보안    | 냉철하고 기술적   |
| 👩‍👧 **BALTHASAR** | 어머니    | 유지보수성, 가독성, 컨벤션, 테스트   | 엄격하지만 협력적 |
| 💃 **CASPER**    | 여자/인간 | UX/UI 일관성, 기획 의도, 사용자 경험 | 직관적이고 감성적 |

## 🚀 빠른 시작

3가지 LLM Provider 중 선택하여 사용할 수 있습니다:

| Provider   | 기본 모델                    | 환경변수                               |
| :--------- | :--------------------------- | :------------------------------------- |
| **Gemini** | `gemini-2.5-flash`           | `GEMINI_API_KEY` 또는 `GCP_PROJECT_ID` |
| **OpenAI** | `gpt-5.2`                    | `OPENAI_API_KEY`                       |
| **Claude** | `claude-sonnet-4-5-20250929` | `ANTHROPIC_API_KEY`                    |

### Option 1: Gemini (기본)

```yaml
- uses: your-org/magi-review@v1
  with:
    gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Option 2: OpenAI (GPT-5)

```yaml
- uses: your-org/magi-review@v1
  with:
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`.github/magi.yml`에서 provider 설정:

```yaml
provider:
  type: openai
  model: gpt-5.2 # optional
```

### Option 3: Claude (Anthropic)

```yaml
- uses: your-org/magi-review@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`.github/magi.yml`에서 provider 설정:

```yaml
provider:
  type: claude
  model: claude-sonnet-4-5-20250929 # optional
```

### Option 4: GCP Vertex AI (엔터프라이즈용)

```yaml
- uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}

- uses: your-org/magi-review@v1
  with:
    gcp_project_id: ${{ secrets.GCP_PROJECT_ID }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Workflow 예제

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
      - uses: your-org/magi-review@v1
        with:
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## ⚙️ 설정 (Optional)

`.github/magi.yml` 파일로 동작을 커스터마이징할 수 있습니다:

```yaml
version: 1

# Provider 설정 (gemini | openai | claude)
provider:
  type: gemini # 또는 openai, claude
  model: gemini-2.5-flash # optional

# 투표 설정
voting:
  required_approvals: 2 # 필요한 찬성 수

# 출력 설정
output:
  pr_comment:
    enabled: true
    style: detailed # summary | detailed
  labels:
    enabled: true
    approved: magi-approved
    rejected: magi-changes-requested

# 무시할 파일
ignore:
  files:
    - "*.lock"
    - "*.generated.*"
  paths:
    - "node_modules/"
    - "dist/"
```

## 🎨 페르소나 커스터마이징

### 페르소나별 Provider 지정

각 페르소나마다 다른 LLM Provider와 모델을 사용할 수 있습니다:

```yaml
# .github/magi.yml
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

> **Note:** 페르소나별 provider를 사용하려면 해당 API key를 모두 설정해야 합니다.

### 공통 지침 추가

`.github/magi/common.md` 파일을 생성하면 모든 페르소나에 적용됩니다:

```markdown
# 우리 팀 추가 지침

## 프로젝트 컨텍스트

- 이 프로젝트는 e-commerce 플랫폼입니다
- PCI DSS 규정 준수 필수

## 팀 컨벤션

- 모든 API는 REST 규칙 준수
- 에러 코드는 ERR\_ prefix 사용
```

### 특정 페르소나 커스터마이징

`.github/magi/melchior.md` 등의 파일로 개별 페르소나를 완전히 커스터마이징할 수 있습니다.

**우선순위:**

1. 커스텀 지침 파일 (있으면 사용)
2. 내장 기본 지침 (없으면 폴백)
3. \+ common.md (항상 추가)

## 📊 출력 예시

```
## 🏛️ MAGI 시스템 리뷰 결과

### ✅ 승인 (2/3)

| 페르소나 | 판정 | 핵심 이유 |
|:-------:|:----:|----------|
| 🔬 MELCHIOR | ✅ | 알고리즘 효율적, 보안 이슈 없음 |
| 👩‍👧 BALTHASAR | ❌ | 테스트 커버리지 부족 |
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

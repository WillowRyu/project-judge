# MAGI Review

여러 AI 리뷰어가 Pull Request를 검토하고 투표를 집계하는 GitHub Action입니다. Gemini, OpenAI Responses API, Claude를 지원하며 리뷰어마다 다른 provider를 사용할 수 있습니다.

[English documentation](README.md)

## 빠른 시작

1. 저장소 Actions secrets에 사용할 provider의 API 키를 추가합니다.
2. `.github/magi.yml`을 PR의 **대상 브랜치(base)에 먼저 머지**합니다. 설정과 지침은 PR 작성자가 변경한 파일이 아닌, 대상 브랜치의 확정된 커밋에서 읽습니다.
3. 아래 워크플로를 추가합니다. `REVIEWED_COMMIT_SHA`는 검토 후 원격 저장소에 올린 버전의 전체 커밋 SHA로 교체하세요. 아직 안정 릴리스 태그를 발행하지 않으므로 운영에서는 변경될 수 있는 `@main` 대신 SHA를 고정합니다.

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

**checkout 단계는 필요하지 않습니다.** 재실행 댓글에는 `/magi-review`만 적습니다. 액션은 GitHub에서 댓글 작성자의 write/maintain/admin 권한을 확인한 뒤 모델을 호출합니다. 외부 fork의 `pull_request` 이벤트는 provider secret을 사용할 수 없어 `skipped` 처리합니다. 저장소 관리자가 fork PR에 `/magi-review`를 남기면 리뷰할 수 있습니다. 권한 없는 댓글과 지원하지 않는 이벤트에서는 모델 호출과 결과 게시를 하지 않습니다.

## Provider와 모델

```yaml
version: 1
provider:
  type: openai                 # gemini | openai | claude
  model: gpt-5.5               # 선택 사항; 명시한 모델을 우선 사용
output:
  language: ko                # ko (기본) | en
```

OpenAI는 workflow의 `openai_api_key`, Claude는 `anthropic_api_key`를 사용합니다. 환경변수 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`로도 전달할 수 있습니다. `GITHUB_TOKEN`은 필수입니다.

| Provider | 기본 모델 |
|---|---|
| Gemini | `gemini-3.5-flash`; 소형 변경 자동 선택은 `gemini-3.5-flash-lite` |
| OpenAI | `gpt-5.5`; Responses API, `store: false` |
| Claude | `claude-sonnet-5` |

모델 우선순위는 **리뷰어 모델 → 명시한 전역 모델 → 설정한 크기별 모델 → provider 기본값/Gemini 자동 모델**입니다. 다른 provider를 사용하는 리뷰어는 자신의 모델을 지정하지 않으면 해당 provider의 기본 모델을 사용합니다. Gemini 자동 구간은 소형 10줄 이하, 중형 11~100줄, 대형 100줄 초과입니다. 중형과 대형은 지원 중인 안정 Flash 모델을 기본으로 사용하며, 다른 모델이 필요하면 직접 지정할 수 있습니다.

Vertex AI는 Application Default Credentials(예: Workload Identity Federation) 인증 후 `gcp_project_id`를 전달합니다. `gcp_location`은 선택 사항이며 지정하면 그대로 사용합니다. 생략하면 모델에 맞는 기본 위치를 선택합니다. 여러 provider를 함께 사용할 경우 전역 provider를 포함해 사용되는 모든 인증 정보를 설정해야 합니다.

## 설정

설정 파일 자동 탐색 순서: `.github/magi.yml`, `.github/magi.yaml`, `.magi.yml`, `.magi.yaml`. 다른 경로는 Action의 `config_path`에 저장소 상대 경로로 지정합니다. 명시한 파일이 없거나, 알 수 없는 설정 키·잘못된 정족수·안전하지 않은 경로가 있으면 오류로 알려줍니다. 작업 경로 밖을 가리키는 심볼릭 링크는 허용하지 않습니다.

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
  max_rounds: 1               # 1~5
  trigger: disagreement       # conflict | disagreement | always
  revote_after_debate: true
output:
  language: ko
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

정상 `approve`는 1표, 정상 `conditional`은 0.5표입니다. 호출 실패·빈 응답·잘못된 JSON·잘린 응답은 기권이며 승인 표에 포함하지 않습니다. `required_approvals`는 리뷰어 수 이하의 양의 정수여야 합니다. 기존 `total_voters`를 지정한다면 실제 리뷰어 수와 일치해야 합니다.

거부 결과는 기본적으로 체크를 실패시키지 않습니다. `voting.fail_on_rejection: true`로 설정하면 `rejected` output을 유지하면서 체크도 실패합니다. 유효 리뷰 수가 부족하거나 검토 범위가 불완전하면 `error`를 반환하고 체크를 실패시킵니다. 브랜치 보호에는 PR workflow의 체크를 지정하세요. 댓글 이벤트의 실행은 PR head에 연결된 체크가 아닙니다.

## 리뷰어와 팀 지침

기본 페르소나는 MELCHIOR(기술적 정확성), BALTHASAR(유지보수성), CASPER(사용자 경험)입니다. 일반적인 프로젝트용 프리셋 `security`, `backend`, `frontend`도 제공합니다.

```yaml
personas:
  - id: security
    name: 보안 리뷰어
    role: Application security engineer
    provider: openai
    model: gpt-5.5
  - id: backend
    provider: claude
  - id: custom
    name: 도메인 리뷰어
    builtin: false
    guideline_file: docs/review/domain.md
```

지침 우선순위는 명시한 `guideline_file` → `.github/magi/`, `.magi/`, `docs/magi/`에서 찾은 `<id>.md` → 내장 지침입니다. `builtin: false`이면 내장 지침으로 대체하지 않습니다. `name`, `emoji`, `role`은 내장 페르소나에도 적용됩니다. 같은 탐색 경로의 `common.md` 또는 `COMMON.md`는 공통 지침으로 한 번 추가합니다. ID는 중복되지 않는 안전한 이름이어야 합니다. 지침 변경도 대상 브랜치에 먼저 반영해야 합니다.

커스텀 지침은 다음 JSON 응답 형식을 요청해야 합니다.

```json
{"vote":"approve","reason":"핵심 이유","details":"리뷰 본문","suggestions":[]}
```

`vote`는 `approve`, `reject`, `conditional` 중 하나입니다. `reason`은 비어 있지 않은 문자열, `details`는 문자열, `suggestions`는 문자열 배열입니다. 선택한 출력 언어는 리뷰·토론 프롬프트에 별도로 전달됩니다.

## 검토 범위와 출력

GitHub에서 제공한 patch를 리뷰하며 전체 저장소를 읽는 방식은 아닙니다. 무시한 파일은 검토 범위에서 제외합니다. patch 누락, GitHub에서 잘린 patch, 토큰 예산 때문에 잘린 diff는 댓글과 `coverage`에 표시하고 승인을 막습니다. GitHub 파일 목록이 일부만 반환되는 경우에도 리뷰 전에 실패시키며, `coverage.unavailableFiles`에 누락 개수를 표시합니다(API는 최대 3,000개 파일). PR을 나누거나 제외 정책·토큰 예산을 조정해 전체 범위를 검토할 수 있습니다.

토큰 예산은 보수적인 **추정치**이며 정확한 과금 토큰 수가 아닙니다. 지침·PR 설명·토론 의견은 diff 예산에 포함되지 않습니다. 기본 리뷰어 3명은 보통 모델 호출 3회가 필요하고, 캐싱·재시도·토론으로 요청이 추가될 수 있습니다. `prompt_compression: false`는 변경 주변 문맥을 보존하지만 예산 제한은 유지합니다. 기본 제외 항목에는 생성 파일, lockfile, 빌드 결과, 의존성 폴더가 포함됩니다. `ignore.use_defaults: false`로 기본 제외를 해제할 수 있습니다.

| Output | 의미 |
|---|---|
| `result` | `approved`, `rejected`, `skipped`, `error` |
| `skip_reason` | 건너뛴 이유; 정상 실행이면 빈 문자열 |
| `votes` | 리뷰어별 JSON; 실패 시 `vote: "abstain"`, `error: true` |
| `coverage` | `complete`, `totalFiles`, `reviewedFiles`, `omittedFiles`, `truncatedFiles`; diff 분석 전에는 `{}` |
| `reviewed_head_sha` | 검토한 커밋; 최종 `result`와 함께 확인 |
| `comment_status` | `success`, `failed`, `skipped` |
| `labels_status` | 판정 라벨 게시 상태; 오래된 라벨 정리 실패도 `failed` |
| `slack_status` | `success`, `failed`, `skipped`; 알림 조건 불일치는 `skipped` |

라벨을 활성화하면 새 리뷰 시작 및 건너뜀·오류 시 이전 판정 라벨을 정리합니다. 실행 중 PR이 변경되면 이전 코드의 판정을 게시하지 않습니다. 댓글·알림 실패는 비차단이며 각 status output으로 확인할 수 있습니다.

Slack은 `notifications.slack.enabled: true`와 Action 입력 `slack_webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}`을 함께 설정합니다. `notify_on: rejection`은 판정이 확정된 거부 결과에만 적용되고, `all`은 리뷰 후 판정 불가 결과도 포함합니다.

## 개발과 마이그레이션

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

Node 24와 `packageManager`에 고정된 pnpm을 사용합니다. `pnpm build`는 `dist/`를 새 결과로 교체하므로 소스 변경과 함께 포함해야 합니다. CI는 타입·테스트·번들 일치·의존성 감사를 수행합니다. Dependabot은 매주 패키지와 Action 업데이트를 제안합니다. 소스 머지 뒤 CI가 별도의 dist 커밋을 자동 push하던 방식은 사용하지 않습니다.

0.2의 변경점: PR base에서 정책 로드, 엄격한 설정 검증, 잘못된 응답 기권 처리, 불완전한 검토 범위의 실패 처리, OpenAI Responses 사용, Node 24 전환입니다. 기존 한국어·MAGI 기본값과 생성 파일 제외 정책은 유지합니다. 일반 프리셋과 영어 출력은 설정에서 선택합니다. TypeScript 5와 Zod 3은 불필요한 대규모 마이그레이션을 피하기 위해 유지했습니다.

## 라이선스

MIT

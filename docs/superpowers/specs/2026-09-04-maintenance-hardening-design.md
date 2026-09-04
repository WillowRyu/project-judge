# MAGI maintenance and general-purpose readiness

The user approved implementing the September 4 audit recommendations. Preserve the GitHub Action architecture and default Korean/MAGI experience while correcting verdict reliability, trust, configuration, and lifecycle problems.

## Decisions

- Invalid, empty, incomplete, or missing code reviews cannot count toward approval. Report coverage; incomplete diff coverage produces `result=error`, a visible explanation, and no approval label.
- Respect explicit provider/model choices. Route OpenAI through Responses; use supported Gemini defaults, retaining model overrides. Preserve full context on cache fallback and honor explicit Vertex locations.
- Read policy/config/guidelines from the trusted PR base commit, never PR-controlled head files. Validate comment permission with GitHub collaborator permission API. Reject files resolving outside their trusted root. No LLM calls for unauthorized triggers.
- Validate config strictly, distinguish discovery from an explicit missing path, validate persona identity/quorum, and implement documented persona and debate options.
- Preserve nonblocking rejection by default; support an explicit fail-on-rejection option. Report real publishing failures and remove stale verdict labels on incomplete/error/skipped review.
- Add `output.language: ko|en` (default ko), neutral reviewer presets security/backend/frontend, and truthful diff coverage in outputs/comments.
- Upgrade to Node 24, pin pnpm, refresh supported dependencies and lockfile, remove unused legacy Google SDK, and rebuild the distributable. Keep major language/schema upgrades out unless needed for security or compatibility.
- CI must build as well as test, verify dist, and use maintained Actions. Public examples pin an immutable released commit until a new release is explicitly published; no publishing or push in this task.
- Verification uses offline mocks, unit/integration tests, Node 24 typecheck/build, dependency audit, and a final code review. No paid provider calls or external messaging.

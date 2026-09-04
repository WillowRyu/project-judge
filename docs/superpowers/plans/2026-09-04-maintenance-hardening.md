# Maintenance hardening implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Complete the approved work without another permission gate.

**Goal:** Resolve the audited reliability, security, usability and lifecycle defects.
**Architecture:** Keep existing module layout. Concentrate diff coverage and provider execution in the review module, trusted file resolution in config/persona loading, and user-facing state in the Action/publishing modules.
**Tech Stack:** TypeScript, Node 24, pnpm, Vitest, ncc, GitHub Actions, OpenAI/Anthropic/Google SDKs.
**Spec:** docs/superpowers/specs/2026-09-04-maintenance-hardening-design.md

## Global constraints
- Default output language `ko`; support `en`.
- Default rejection remains nonblocking. No invalid or incomplete reviews may approve.
- No live LLM requests, push, release, merge, or messages to external services.
- Work on codex/maintenance-hardening in the shared checkout; source was clean with 39 passing tests and a successful build.

### Task 1: Reliable review pipeline
- [x] Add and observe failing regressions for wrong global models, malformed responses, cache context loss, token budget enforcement, missing patch coverage, and debate revote behavior.
- [x] Implement model precedence, Responses transport, schema-valid review/debate parsing, complete cache fallback, bounded diff preparation with coverage, and language-aware prompts.
- [x] Run relevant tests, typecheck, and review task diff.

### Task 2: Trusted and predictable configuration
- [x] Add failing tests for missing explicit files, alternate discovery, unknown keys, persona overrides, custom guideline files, symlink escape, and invalid persona/quorum settings.
- [x] Implement strict config and confined file loading; add neutral presets and options for language, diff budgets, explicit rejection gating.
- [x] Run relevant tests and review task diff.

### Task 3: Runtime and dependencies
- [x] Pin Node 24 and pnpm; upgrade SDKs, Actions packages and test toolchain; remove unused Google SDK.
- [x] Install, audit dependency paths, resolve actionable advisories, and verify build compatibility.
- [x] Update CI and build workflow; add dependable dist check and upgrade automation config.

### Task 4: Secure Action integration and truthful output
- [x] Test trusted base policy loading and comment authorization; retrieve trusted files without checking out untrusted source.
- [x] Integrate coverage gating, language, accurate labels/slack outputs, error outputs and optional rejection gating.
- [x] Implement English output and coverage notices; update workflow examples and complete usage/migration docs.

### Task 5: Verify and deliver
- [x] Run Node 24 typecheck, all tests, dependency audit and dist build/check.
- [x] Obtain independent code review; resolve concrete findings and reverify affected gates.
- [x] Record validation and leave reviewable local changes; no push or publish.

## Final validation

All five tasks are complete.

- Node 24.20.0; pnpm 11.25.0; frozen-lockfile installation passes.
- Typecheck passed; 106 tests passed across 19 test files.
- Generated dist rebuilt; deterministic comparison and actual bundled entrypoint smoke passed without credentials.
- Dependency audit: 0 advisories at all severities, including development dependencies.
- Independent task and final reviews completed. Fixed raw cache diagnostics, empty rationale approvals, and incomplete GitHub file-list coverage findings.
- Import-only Actions SDKs required preserving ES imports for ncc; the produced entrypoint remains CommonJS and is checked by smoke:dist in CI.
- No paid provider or remote Actions execution was performed. No push or release was created.
- Local changes remain on codex/maintenance-hardening for review.

# Maintenance

## Releasing a reviewed version

1. Use Node 24 and the pinned pnpm from `package.json`.
2. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm check:dist`, `pnpm smoke:dist`, and `pnpm audit`.
3. Include regenerated `dist/` with the source change. The Action executes this bundle, not `src/`. TypeScript preserves ES module imports for the bundler so import-only Actions SDK packages resolve; ncc still emits a Node-compatible CommonJS entrypoint. The smoke check catches unresolved imports that ncc can otherwise emit without a build failure.
4. Review and push the commit through the repository's normal process. Consumers can pin that full SHA. Create a version tag/release only after the commit has passed CI and been accepted.
5. Replace `REVIEWED_COMMIT_SHA` in consumer workflows with the accepted version's full SHA. A moving main-branch reference is not a release guarantee.

Dependabot runs weekly for npm and GitHub Actions. For a dependency update, refresh affected transitive versions, rebuild `dist/`, and inspect advisories. Compatible overrides in `pnpm-workspace.yaml` patch vulnerable Rollup, PostCSS and nanoid ranges; remove them when the upstream graph no longer resolves those ranges. Vite 7 is an explicit development dependency so Vitest does not retain a vulnerable older peer resolution.

Only esbuild's install script is enabled. The packaged Google SDK is already built and its preinstall is a no-op; protobufjs is shipped ready to use, so their lifecycle scripts remain disabled.

## Models and runtime

Default model IDs are deliberately configurable. Validate availability on the exact backend (Gemini Developer API and Vertex AI have different lifecycles) before changing defaults, then exercise routing, cache fallback, incomplete outputs, and a separately authorized live smoke test.

Primary lifecycle references:

- [GitHub PR file-list limits](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files)
- [GitHub Node 20 to Node 24 migration](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)
- [Gemini API model deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- [Google Cloud model lifecycles](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions)
- [Gemini 3.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash)
- [OpenAI GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5)
- [OpenAI Responses migration](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [Claude model lifecycle](https://platform.claude.com/docs/en/about-claude/model-deprecations)

## Trust and incomplete reviews

Review policy is always loaded from the PR's base commit through GitHub's contents API. Never change this to a PR checkout or allow an untrusted command author to select a trusted ref. Model access must follow the server-side write-permission check for comment triggers. The local loaders also enforce real-path confinement.

A passing unit suite does not demonstrate model availability, actual token billing, or remote GitHub permission behavior. Offline regressions verify transport construction, response validation, votes, budgets, policy provenance, and publishing decisions; keep any live-provider verification explicit and separate.

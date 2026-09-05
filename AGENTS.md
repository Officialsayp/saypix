# AGENTS.md — saypix

Repository instructions for the static bilingual portfolio at `maxzolotoy.com`.
Read narrower `AGENTS.md` / `AGENTS.override.md` files when working in a subdirectory.
Explicit user instructions take precedence over repository workflow defaults, within
the system/developer instructions and tool permissions.

## Start here

- Inspect `git status --short`, relevant existing diffs, `package.json` and the files
  involved in the request. Preserve unfinished user work.
- Use `rg` / `rg --files` to locate code. Read the relevant paths below; a small
  content change does not require a full repository or infrastructure audit.
- Complete the requested change and its verification. Resolve routine, reversible
  choices using existing conventions; ask only when a missing decision materially
  affects scope, correctness or an action that lacks authorization.
- Incorporate new user messages into the current task. A status question does not
  cancel unfinished work. For long tasks, retain decisions and remaining checks
  across context compaction.
- If available and allowed by the session, delegate bounded independent work when it
  helps; assign distinct files and review the result. Keep small edits local.
- Answer in the user's language, briefly: result, checks actually run, and remaining
  limitations. Explain an instruction-based blocker by citing the exact file/rule.

## Repository map

| Task | Read / edit |
| --- | --- |
| RU/EN copy, contacts, visible links | `src/content.js` |
| Page structure and navigation | `src/render.js`, `src/template.html` |
| Layout, responsive behavior, focus, motion | `src/styles.css` |
| Initial language-switch bootstrap | `src/boot.js` |
| Drag interaction and geometry | `src/curtain.js`, `src/curtain-math.js` |
| Canonical URLs, social metadata, structured data | `src/metadata.js`, `src/sitemap.xml`, `src/robots.txt`, `src/og-*` |
| Icons | `src/tech-icons.svg`, `src/favicon.svg` |
| Build and static validation | `scripts/build.mjs`, `scripts/check-*.mjs` |
| Redirects and caching | `src/_redirects`, `src/_headers`, `deploy/caddy/` |
| Operations and recovery | `docs/recovery-runbook.md`, `docs/ru-network-resilience.md`, `.github/workflows/` |

`README.md` describes local development. For current deployment intent, start with
the recovery runbook: it records direct Caddy/VPS hosting and Cloudflare DNS, while
the README also documents the older Workers Static Assets profile. Verify live
state before operational changes; a config file's existence does not make it active.

## Architecture and behavior to preserve

- Static HTML/CSS and native JavaScript modules; esbuild is a build dependency.
  Keep the runtime free of frameworks and dependencies unless a requested change
  justifies revisiting this design. Reuse native/browser capabilities first.
- `/ru/` and `/en/` each contain complete, indexable content without JavaScript.
  Keep URL, document language, copy, canonical URL and `hreflang` consistent.
  Preserve English `x-default`, localized social metadata and structured data.
- The initial DOM contains one language. Load the curtain and alternate-language
  fragment only after user interaction. A failed lazy request must leave normal
  RU/EN links usable. Do not replace real navigation with a client-only language state.
- Preserve pointer, touch, keyboard, focus and reduced-motion behavior. Language
  preference may use `localStorage`; storage failure must not break navigation.
- Preserve accessible HTML, usable links, readable contrast and layouts without
  page-wide overflow. Keep RU/EN content semantically aligned without inventing
  personal facts, contacts or project claims.
- Keep assets local and respect the budgets in `scripts/check-sizes.mjs`.
  Fix unnecessary payload growth before proposing a budget increase.
- `dist/` is tracked generated output. Edit sources and regenerate it; never patch
  hashed assets by hand. Include corresponding generated changes with source changes.
- Preserve immutable caching for fingerprinted assets and revalidation for HTML
  and stable filenames. Keep canonical redirects and query-string preservation
  consistent across the applicable hosting profiles.

## Commands and verification

Run commands from the repository root. Use npm and the existing
`package-lock.json`; do not introduce another lockfile.

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked build dependencies |
| `npm run build` | Regenerate `dist/` and report asset sizes |
| `npm run check` | Syntax, generated HTML/SEO, curtain math, size budgets and local HTTP smoke checks; requires a current build |
| `npm run check:deploy` | Local assertions for deployment files; does not deploy |
| `npm test` | Build plus both check groups |
| `npm run preview` | Build and serve `dist/` on port 4173; requires Python 3 |

- For source, assets, build or deployment-file changes, run `npm test`. CI also
  checks `git diff --exit-code -- dist` after building a committed change; generated
  files must already match the sources in that commit.
- For documentation-only changes, check facts, referenced paths/commands and
  `git diff --check`; do not install dependencies or rebuild unchanged assets solely
  for prose. Complete any additional checks explicitly requested by the user or CI.
- For interaction/layout changes, inspect both languages on desktop and mobile,
  including keyboard use, reduced motion and the no-JavaScript fallback. Automated
  static checks alone do not prove the drag interaction or visual layout works.
- Python's preview server does not apply hosting headers or redirects. Local smoke
  tests model them; production behavior requires a separate check of the actual host.
- Add focused regression coverage for behavioral bugs. Do not add tests that only
  repeat an implementation, weaken existing assertions, or repeat passing checks
  without a new change or unresolved concern.
- Finish by inspecting the diff/status for unintended files. Report failed or
  unavailable checks honestly, with the command, reason and unverified behavior.

## Git and operations

- Keep the diff focused. Do not discard user changes, rewrite history, force-push
  or delete branches without explicit authorization.
- Commit/push/PR actions require authorization from the request or existing session.
  For reviewable GitHub edits, prefer a `codex/` branch and PR.
- A push to `main` can deploy production through
  `.github/workflows/deploy-direct-origin.yml` when
  `DIRECT_ORIGIN_DEPLOY_ENABLED` is enabled. Treat merging to `main` as a possible
  deployment; do not infer deployment authorization from a request for local edits.
- For authorized infrastructure work, follow the runbooks, preserve rollback and
  protect mail/verification DNS records. Do not print or commit credentials or
  private environment values.

## Maintaining these instructions

Keep this file limited to durable repository rules and useful navigation. Update
paths/commands when they change; keep operational procedures in the runbooks.

Reviewed against [OpenAI AGENTS.md guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
and [GPT-6 Astra guidance](https://developers.openai.com/api/docs/guides/latest-model)
on 2026-09-06. Model selection and reasoning effort belong in Codex settings, not
in this Markdown file.

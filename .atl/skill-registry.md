# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| implementation, commit splitting, chained PRs, keeping tests and docs with code | work-unit-commits | `C:\Users\CORREA-ERICK\.config\opencode\skills\work-unit-commits\SKILL.md` |
| writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs | cognitive-doc-design | `C:\Users\CORREA-ERICK\.config\opencode\skills\cognitive-doc-design\SKILL.md` |
| PRs over 400 lines, stacked PRs, review slices | chained-pr | `C:\Users\CORREA-ERICK\.config\opencode\skills\chained-pr\SKILL.md` |
| creating, opening, or preparing PRs for review | branch-pr | `C:\Users\CORREA-ERICK\.config\opencode\skills\branch-pr\SKILL.md` |
| creating GitHub issues, bug reports, or feature requests | issue-creation | `C:\Users\CORREA-ERICK\.config\opencode\skills\issue-creation\SKILL.md` |
| creating PRs, writing PR descriptions, or using gh CLI for pull requests | github-pr | `C:\Users\CORREA-ERICK\.claude\skills\github-pr\SKILL.md` |
| PR feedback, issue replies, reviews, Slack messages, or GitHub comments | comment-writer | `C:\Users\CORREA-ERICK\.config\opencode\skills\comment-writer\SKILL.md` |
| new skills, agent instructions, documenting AI usage patterns | skill-creator | `C:\Users\CORREA-ERICK\.config\opencode\skills\skill-creator\SKILL.md` |
| judgment day, dual review, adversarial review, juzgar | judgment-day | `C:\Users\CORREA-ERICK\.config\opencode\skills\judgment-day\SKILL.md` |
| Go tests, go test coverage, Bubbletea teatest, golden files | go-testing | `C:\Users\CORREA-ERICK\.config\opencode\skills\go-testing\SKILL.md` |
| Writing React components — no useMemo/useCallback needed | react-19 | `C:\Users\CORREA-ERICK\.claude\skills\react-19\SKILL.md` |
| Writing TypeScript code — types, interfaces, generics | typescript | `C:\Users\CORREA-ERICK\.claude\skills\typescript\SKILL.md` |
| Styling with Tailwind — cn(), theme variables, no var() in className | tailwind-4 | `C:\Users\CORREA-ERICK\.claude\skills\tailwind-4\SKILL.md` |
| Working with Next.js — routing, Server Actions, data fetching | nextjs-15 | `C:\Users\CORREA-ERICK\.claude\skills\nextjs-15\SKILL.md` |
| Building mobile apps, React Native, Expo, React Navigation, NativeWind | react-native | `C:\Users\CORREA-ERICK\.claude\skills\react-native\SKILL.md` |
| Writing E2E tests — Page Objects, selectors, MCP workflow | playwright | `C:\Users\CORREA-ERICK\.claude\skills\playwright\SKILL.md` |
| Writing Python tests — fixtures, mocking, markers | pytest | `C:\Users\CORREA-ERICK\.claude\skills\pytest\SKILL.md` |
| web components, pages, artifacts, posters, or applications (UI) | frontend-design | `C:\Users\CORREA-ERICK\.claude\skills\frontend-design\SKILL.md` |
| interface design — dashboards, admin panels, apps, tools, interactive products | interface-design | `C:\Users\CORREA-ERICK\.claude\skills\interface-design\SKILL.md` |
| Designing new APIs, reviewing API specifications, establishing API design standards | api-design-principles | `C:\Users\CORREA-ERICK\.claude\skills\api-design-patterns\SKILL.md` |
| Implementing error handling, designing APIs, improving application reliability | error-handling-patterns | `C:\Users\CORREA-ERICK\.claude\skills\error-handling-patterns\SKILL.md` |
| any bug, test failure, or unexpected behavior, before proposing fixes | systematic-debugging | `C:\Users\CORREA-ERICK\.claude\skills\systematic-debugging\SKILL.md` |
| Creating user-facing changelogs from git commits | changelog-generator | `C:\Users\CORREA-ERICK\.claude\skills\changelog-generator\SKILL.md` |
| Building AI chat features — breaking changes from v4 | ai-sdk-5 | `C:\Users\CORREA-ERICK\.claude\skills\ai-sdk-5\SKILL.md` |
| Structuring Angular projects or deciding where to place components | angular-architecture | `C:\Users\CORREA-ERICK\.claude\skills\angular\architecture\SKILL.md` |
| Creating Angular components, using signals, or setting up zoneless | angular-core | `C:\Users\CORREA-ERICK\.claude\skills\angular\core\SKILL.md` |
| Working with forms, validation, or form state in Angular | angular-forms | `C:\Users\CORREA-ERICK\.claude\skills\angular\forms\SKILL.md` |
| Optimizing Angular app performance, images, or lazy loading | angular-performance | `C:\Users\CORREA-ERICK\.claude\skills\angular\performance\SKILL.md` |
| Building REST APIs with Django — ViewSets, Serializers, Filters | django-drf | `C:\Users\CORREA-ERICK\.claude\skills\django-drf\SKILL.md` |
| Building desktop apps, Electron main/renderer processes, IPC, native integrations | electron | `C:\Users\CORREA-ERICK\.claude\skills\electron\SKILL.md` |
| Elixir code review, refactoring, Phoenix/Ecto code | elixir-antipatterns | `C:\Users\CORREA-ERICK\.claude\skills\elixir-antipatterns\SKILL.md` |
| Building REST APIs with Spring Boot 3 | spring-boot-3 | `C:\Users\CORREA-ERICK\.claude\skills\spring-boot-3\SKILL.md` |
| Structuring Java apps by Domain/Application/Infrastructure | hexagonal-architecture-layers-java | `C:\Users\CORREA-ERICK\.claude\skills\hexagonal-architecture-layers-java\SKILL.md` |
| Writing Java 21 code using records, sealed types, or virtual threads | java-21 | `C:\Users\CORREA-ERICK\.claude\skills\java-21\SKILL.md` |
| Creating Jira tasks, tickets, or issues | jira-task | `C:\Users\CORREA-ERICK\.claude\skills\jira-task\SKILL.md` |
| Creating Jira epics for large features | jira-epic | `C:\Users\CORREA-ERICK\.claude\skills\jira-epic\SKILL.md` |
| Managing React state with Zustand | zustand-5 | `C:\Users\CORREA-ERICK\.claude\skills\zustand-5\SKILL.md` |
| Using Zod for validation — breaking changes from v3 | zod-4 | `C:\Users\CORREA-ERICK\.claude\skills\zod-4\SKILL.md` |
| React and Next.js performance optimization guidelines | vercel-react-best-practices | `C:\Users\CORREA-ERICK\.claude\skills\vercel-react-best-practices\SKILL.md` |
| Starting any conversation — establishes skill tool invocation | using-superpowers | `C:\Users\CORREA-ERICK\.claude\skills\using-superpowers\SKILL.md` |
| Building CLI, command-line tools, or terminal applications | typer-cli-patterns | `C:\Users\CORREA-ERICK\.claude\skills\typer-cli-patterns\SKILL.md` |
| Rust async programming with Tokio, async traits, error handling | rust-async-patterns | `C:\Users\CORREA-ERICK\.claude\skills\rust-async-patterns\SKILL.md` |
| Generating a complete Rust MCP server project with rmcp SDK | rust-mcp-server-generator | `C:\Users\CORREA-ERICK\.claude\skills\rust-mcp-server-generator\SKILL.md` |
| Handling sensitive data, API keys, passwords, implementing security | cryptography-security | `C:\Users\CORREA-ERICK\.claude\skills\cryptography-security\SKILL.md` |
| Integrating multiple LLMs, implementing fallbacks, calling LLM APIs | litellm-integration | `C:\Users\CORREA-ERICK\.claude\skills\litellm-integration\SKILL.md` |
| Building 1-click launchers using Pinokio | gepeto | `C:\Users\CORREA-ERICK\.agents\skills\gepeto\SKILL.md` |
| Discovering, launching, and using apps via Pinokio | pinokio | `C:\Users\CORREA-ERICK\.agents\skills\pinokio\SKILL.md` |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### work-unit-commits
- Commit by work unit: one deliverable behavior/fix/migration/docs per commit
- Keep tests with the code they verify in the same commit
- Keep docs with the user-visible change they explain
- Do NOT commit by file type (models, then services, then tests)
- Each commit tells a story — reviewer understands why it exists from diff + message

### cognitive-doc-design
- Lead with the answer: decision/action/outcome first, context second
- Progressive disclosure: happy path → details → edge cases → references
- Chunking: group related info into small sections, keep flat lists short
- Signposting: headings, labels, callouts, summaries so reader knows location
- Recognition over recall: tables/checklists/examples over prose
- Review empathy: design so reviewers verify intent without reconstructing

### chained-pr
- Split PRs over 400 changed lines unless maintainer explicitly accepts `size:exception`
- Keep each PR reviewable in ≤60 minutes
- State start, end, dependencies, follow-up, and out-of-scope in every chained PR
- Every child PR must include a dependency diagram marking current PR with `📍`
- In Feature Branch Chain: tracker is draft; child PR #1 targets tracker; later children target parent branch
- Fix polluted diffs by retargeting/rebase until only current work unit appears
- Do not mix chain strategies after user chooses one

### branch-pr
- Every PR MUST link an approved issue — no exceptions
- Every PR MUST have exactly one `type:*` label
- Automated checks must pass before merge
- Blank PRs without issue linkage are blocked by GitHub Actions

### github-pr
- PR title = conventional commit format: `<type>(<scope>): <description>`
- Types: feat, fix, docs, refactor, test, chore, style, perf, ci, build, revert
- PR body template: Summary → Changes → Screenshots → Testing → Related Issues
- Use `gh pr create` with `--title` and `--body` flags
- NEVER use -i flag (interactive) — supply all args

### issue-creation
- Issue template: Description → Steps to Reproduce → Expected vs Actual → Environment
- Label appropriately: bug, enhancement, question, etc.
- Check for duplicates before creating
- Include reproduction steps for bugs

### comment-writer
- Warm and direct collaboration tone
- Start with what you like/appreciate, then the constructive feedback
- Be specific: reference exact lines/files
- Suggest, don't command — "What if we..." over "Change this to..."
- End with an open question to continue the conversation

### skill-creator
- Skill is a runtime instruction contract for an LLM, not human documentation
- Required structure: frontmatter → Activation Contract → Hard Rules → Decision Gates → Execution Steps → Output Contract → References
- Keep body 180-450 tokens, max 1000; move bulk to references/
- References must be local files relative to skill directory
- Do NOT add Keywords section; preserve triggers in description
- description: quoted, one physical line, trigger-first, ≤250 chars

### judgment-day
- Launch two blind judges in parallel with identical target and criteria
- Never review the code yourself
- Wait for both judges before synthesis
- Classify warnings as WARNING(real) only if normal intended use triggers; else downgrade to INFO
- Ask before fixing Round 1 confirmed issues
- After fix agent runs, re-launch both judges before commit/push
- Terminal states: JUDGMENT: APPROVED or JUDGMENT: ESCALATED
- After 2 fix iterations with remaining issues, ask user whether to continue

### go-testing
- Use `go test ./...` for running all tests
- Use `go test -cover` for coverage
- For Bubbletea: use `teatest` for testing TUI components
- Golden files: store expected output in `testdata/` with `.golden` extension
- Table-driven tests for multiple cases

### react-19
- No useMemo/useCallback — React Compiler handles memoization automatically
- Always use named imports: `import { useState } from "react"` — never default or `*`
- Server Components by default (no directive); add `"use client"` only for interactivity/hooks
- `ref` is a regular prop — no forwardRef needed
- Actions: use `useActionState` for form mutations, `useOptimistic` for optimistic UI
- Use `use()` hook for promises/context — replaces `useEffect` for data fetching

### typescript
- Const types pattern: create `as const` object first, then extract `type X = (typeof X)[keyof typeof X]`
- Flat interfaces: one level depth, nested objects → dedicated interface; use `extends` for inheritance
- Never use `any` — use `unknown` with type guards
- Prefer `interface` for public APIs, `type` for unions/computed types
- Use `satisfies` operator for type validation without widening

### tailwind-4
- Never use `var()` in className — use Tailwind semantic classes `bg-primary` not `bg-[var(--color-primary)]`
- Never use hex colors in className — use Tailwind color classes `text-white` not `text-[#ffffff]`
- Use `cn()` utility (clsx + twMerge) for conditional styles
- Static only styles → no `cn()` needed, just `className="..."`
- Dynamic values → `style={{ width: \`${x}%\` }}`

### nextjs-15
- App Router conventions: layout.tsx, page.tsx, loading.tsx, error.tsx, not-found.tsx
- Server Components by default (async, no directive)
- Server Actions: `"use server"` in separate actions.ts, use `revalidatePath` and `redirect`
- Route groups `(auth)/` for organization without URL impact
- Private folders `_components/` are not routed
- API routes in `app/api/route.ts`

### react-native
- Expo Router for navigation: `src/app/` with file-based routing
- NativeWind for Tailwind-like styling in RN
- Functional components with TypeScript always
- Platform-specific code: use `.ios.tsx` / `.android.tsx` extensions or `Platform.select()`
- Zustand for state management
- Avoid inline styles — use StyleSheet.create or NativeWind classes

### playwright
- ALWAYS use MCP tools first: navigate → snapshot → interact → screenshot → verify → document selectors
- NEVER assume how UI "should" work — explore first
- Page Object Model: one page class per feature
- All tests in ONE `.spec.ts` file per feature (no splitting)
- Use data-testid or role selectors over CSS selectors for stability

### frontend-design
- Choose a BOLD aesthetic direction before coding: brutalist, minimal, retro-futuristic, organic, etc.
- Typography: distinctive fonts (avoid Inter, Roboto, Arial, system fonts)
- Color: cohesive palette with CSS variables; dominant colors with sharp accents
- Motion: CSS-only for HTML, Motion library for React; staggered reveals with animation-delay
- Spatial composition: asymmetry, overlap, grid-breaking, generous negative space
- NEVER use generic AI aesthetics (purple gradients, Space Grotesk, predictable layouts)

### interface-design
- For dashboards, admin panels, SaaS apps, tools — NOT marketing/landing pages
- Typography IS the design — choose characterful fonts that match the product personality
- Navigation IS the product — it teaches users how to think about the space
- Data tells a story — a number on screen is not design; show meaning not just values
- Token names ARE design decisions — `--ink` and `--parchment` evoke a world; `--gray-700` is a template
- Every decision is design — there are no "structural" vs "creative" decisions

### systematic-debugging
- IRON LAW: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
- Phase 1: reproduce reliably, isolate minimal reproducer
- Phase 2: find root cause (not just symptom)
- Phase 3: fix only after root cause is identified
- Phase 4: verify fix and add regression test
- Symptom fixes are failure — always find the underlying cause

### api-design-principles
- Resources are nouns, not verbs; use HTTP methods for actions
- GET: retrieve (idempotent, safe) | POST: create | PUT: replace (idempotent) | PATCH: partial update | DELETE: remove (idempotent)
- Consistent naming: plural nouns (`/users` not `/user`), kebab-case for multi-word
- Version APIs via header or prefix (`/v1/`)
- Use proper HTTP status codes (200, 201, 204, 400, 401, 403, 404, 409, 500)
- Pagination: cursor-based for lists; include `next_cursor` in response

### error-handling-patterns
- Exceptions for unexpected errors; Result types for expected/validation errors
- Panics/crashes only for unrecoverable/programming bugs
- Always include error context (what failed, why, how to fix)
- Graceful degradation: never crash the app on recoverable errors
- Retry with exponential backoff for transient failures
- Circuit breaker pattern for external service calls

### changelog-generator
- Categorize: features, improvements, bug fixes, breaking changes, security
- Translate technical commits → customer-friendly language
- Filter out internal commits (refactoring, tests, chores)
- Follow [Keep a Changelog](https://keepachangelog.com) format
- One changelog entry per significant user-facing change

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| AGENTS.md | `C:\Users\CORREA-ERICK\.config\opencode\AGENTS.md` | Engram protocol + persona rules |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.

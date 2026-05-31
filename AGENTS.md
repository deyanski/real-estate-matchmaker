# AGENTS.md — Next.js + Supabase Webhook Integration Template

Primary configuration for Copilot agents and contributors in projects where most work is web application logic and only a small portion is webhook-based workflow integration.
Read this before writing any code.

---

## Mission

Build secure, typed, production-grade web applications with:
- Next.js App Router + TypeScript strict mode
- Supabase (Auth + Postgres + RLS)
- Webhook-based workflow integrations

Priorities in order:
1. Correctness, security, and data integrity
2. Strong API contracts and validation
3. Performance and maintainability
4. Distinctive, intentional UX
5. Reliable outbound webhook integration

---

## Workload Profile

Assume this default split unless project overrides it:
- 95%: product app work (routes, UI, domain logic, data access, tests)
- 5%: workflow integration (webhook contracts, retries, observability)

This means:
- Design architecture around the app as the source of truth.
- Keep workflow tooling optional and loosely coupled.
- Avoid pulling workflow-specific complexity into core app layers.

---

## Skills

Load the relevant skill BEFORE starting the task. Use read_file on the skill SKILL.md path.

### Primary skills (most tasks)

| Task type | Skill to load |
|---|---|
| Next.js routing, RSC boundaries, async APIs | `.agents/skills/next-best-practices/SKILL.md` |
| React/Next performance review or optimization | `.agents/skills/vercel-react-best-practices/SKILL.md` |
| React component API design and composition | `.agents/skills/vercel-composition-patterns/SKILL.md` |
| UI components, pages, dashboard, empty states | `.agents/skills/frontend-design/SKILL.md` |
| UI audit, accessibility, and UX compliance review | `.agents/skills/web-design-guidelines/SKILL.md` |
| Unit testing with Vitest | `.agents/skills/vitest/SKILL.md` |
| Missing/uncertain external API docs | Use Context7 per `.github/instructions/context7.instructions.md` |

Rule of thumb:
- Do not load workflow-heavy skills for normal app tasks.
- Add workflow-specific skills only when integration details are the actual task.

---

## Standard Build Flow

1. Clarify request and constraints.
2. Load only the relevant skill set.
3. Inspect existing code and contracts.
4. Implement minimal, focused changes.
5. Validate via typecheck, tests, and lint (as applicable).
6. Summarize changes, risks, and follow-ups.

Integration-specific flow (when webhook changes are involved):
1. Define request/response contract first.
2. Validate schema parsing at the boundary.
3. Add retry and clear error mapping behavior.
4. Add logging and traceability.
5. Verify fallback behavior when workflow endpoint is unavailable.

---

## Stack (Default)

| Layer | Choice |
|---|---|
| Framework | Next.js 16+, App Router, TypeScript strict mode |
| Styling | Tailwind CSS v4 + shadcn/ui + lucide-react |
| Auth + Database | Supabase Auth + Postgres (no ORM) |
| Row-level security | RLS enabled on every table from day one |
| Response validation | Zod parse before persistence |
| Search | Postgres full-text search (`tsvector` + GIN) |
| Workflow orchestration | External engine via webhook calls |
| Unit testing | Vitest + @testing-library/react |
| Dev bundler | Turbopack default |
| Deployment | Vercel (or equivalent), env vars in deployment settings |

---

## Project Structure (Template)

Replace with your actual structure. Suggested baseline:

- `app/` routes and route handlers
- `components/` UI and composables
- `lib/server/` server-only clients and integrations
- `lib/contracts/` schema glue and typed DTOs
- `contracts/` request/response JSON schemas and examples
- `integrations/workflows/` webhook clients, mappers, and retry policy
- `workflows/` optional snapshots/placeholders only
- `supabase/migrations/` SQL migrations
- `specifications/` product and architecture specs
- `documents/` reusable docs and templates

---

## Security Rules (Non-negotiable)

- Keep secrets in `.env.local` (local) and deployment secret store (hosted).
- Never commit secret values or production credentials.
- Keep service-role keys server-only.
- Validate all external input at boundaries before business logic.
- Never return raw internal errors from route handlers.
- Redact sensitive values from logs.

---

## API Error Contract (Default)

- 400: validation/input error, return `{ error: string }`
- 401: unauthenticated, return `{ error: "unauthorized" }`
- 403: forbidden, return `{ error: "forbidden" }` when applicable
- 500: internal error, return `{ error: "internal" }`

Never leak stack traces, SQL errors, provider response bodies, or secrets.

---

## TypeScript Rules

- Use `strict: true`.
- Avoid `any`; use `unknown` + narrowing/type guards.
- Keep all boundary contracts strongly typed.
- Generate and use typed database shapes where applicable.

---

## Supabase Rules

- Do not use browser Supabase client in Server Components.
- Prefer explicit column selection over `select('*')` for production queries.
- Enable and test RLS policies for all app-facing tables.
- Keep privileged operations in server-only paths.

---

## Webhook Integration Rules (Workflow-Agnostic)

Treat workflows as external dependencies.

- Keep webhook request and response schemas explicit and versioned.
- Enforce schema validation before sending and after receiving payloads.
- Avoid duplicate side effects for mutation endpoints where relevant.
- Implement timeout, retry, and backoff strategy for transient failures.
- Map external failures into internal error contract consistently.
- Add correlation IDs for cross-system tracing.
- Keep a simple fallback when endpoint health degrades.

Out of scope by default:
- Building or maintaining workflow internals unless explicitly requested.

Note:
- You do not need to reference a specific orchestrator in this template if your boundary is HTTP webhook contracts.

---

## Testing Rules (Template)

- no unit testing

Pre-merge checks:
- `npm run test`
- `npm run lint` (if configured)
- `npm run build` for release-sensitive changes

---

## Design Rules

- Commit to a strong, intentional visual direction.
- Avoid generic typography and default-looking layouts.
- Use CSS variables for theme tokens and spacing.
- Design meaningful empty states for list and dashboard screens.
- Use motion purposefully, not decoratively.

---

## Dependency Rules

- Do not add packages without approval.
- Prefer existing approved stack packages first.
- When requesting a new package, include:
  - Why existing tools are insufficient
  - Security/performance implications
  - Long-term maintenance impact

---

## Definition of Done

A task is complete only when:
1. Requirements are implemented end-to-end.
2. Type safety and contracts are preserved.
3. Validation and tests (as scoped) pass or are explicitly documented if blocked.
4. Security and error-handling rules are respected.
5. Webhook integration behavior is resilient and observable when relevant.
6. Changes are summarized with clear follow-up items.

---

## Project-Specific Overrides

Use this section to override defaults for a specific repository.

- Product scope:
- Supported environments:
- Test scope details:
- Approved package list:
- API contract deviations:
- Workflow provider details:
- Deployment constraints:

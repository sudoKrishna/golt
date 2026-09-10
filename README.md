# Golt

Golt is an AI app-builder: chat with an agent, it plans and writes a real project into a live sandbox, and you watch it run — with GitHub push and full project persistence. Think "Bolt/Lovable, self-hosted," built as a Turborepo monorepo.

## How it works

1. You describe what you want in the chat UI.
2. The backend agent (`agent.ts` + `planner.ts`) turns that into a plan and a sequence of tool calls, using Gemini/OpenAI as the model backend.
3. Generated files are written into a real sandbox — a Vite + React template (`apps/backend/template`) provisioned via E2B / Dockerode — and streamed back to the browser over WebSockets.
4. Every project, file, and chat message is persisted in Postgres via Prisma, so projects survive a refresh.
5. When you're happy with the result, push it straight to a GitHub repo via the GitHub connector.

## Monorepo layout

```
golt/
├── apps/
│   ├── web/       Next.js 16 frontend — chat UI, project sidebar, GitHub connector, live preview
│   └── backend/    Express + WebSocket API — agent orchestration, sandbox lifecycle, auth
├── packages/
│   ├── db/                 @repo/db — Prisma schema, generated client, shared across apps
│   ├── ui/                 @repo/ui — shared React components
│   ├── eslint-config/      @repo/eslint-config — shared lint rules
│   └── typescript-config/  @repo/typescript-config — shared tsconfig bases
├── turbo.json
└── package.json
```

### `apps/web`

Next.js 16 / React 19 / Tailwind 4 frontend.

- `app/components/Chat.tsx` — the chat interface that drives the agent
- `app/components/Sidebar.tsx`, `MyProjects.tsx`, `ProjectMenu.tsx` — project navigation
- `app/components/GithubConnector.tsx` — connects a project to a GitHub repo for push
- `app/lib/api.ts`, `app/lib/ws.ts`, `app/lib/github-api.ts` — REST + WebSocket clients
- `store/project.store.ts` — Zustand store for active project state

### `apps/backend`

Express API with a raw WebSocket layer, run on Bun.

| File | Responsibility |
|---|---|
| `index.ts` | HTTP server bootstrap, WS attach, background reaper for stale sandboxes |
| `app.ts` | Express app, route mounting, CORS |
| `agent.ts` / `planner.ts` / `systemPrompt.ts` | Agent loop: plans steps, calls tools, drives codegen |
| `tools.ts`, `tools/clarification.tool.ts` | Tool definitions the agent can invoke |
| `gemini.ts` | Google Gemini model client |
| `sandbox.ts` / `sandbox.route.ts` / `e2b.ts` | Sandbox lifecycle (create/stop/heartbeat), E2B integration |
| `chat.ts` | Chat message persistence + streaming |
| `project.ts` / `files.ts` | Project and file CRUD, backed by Postgres |
| `auth.ts` / `crypto.ts` / `middlewares/auth.middleware.ts` | Signup/login, JWT auth, password hashing |
| `connectors/github.ts` / `connectors/github-push.ts` | OAuth connection + pushing generated code to GitHub |
| `ws.ts` | WebSocket attach/broadcast for live agent output |
| `template/` | The starter Vite + React app cloned into every new sandbox |

### `packages/db`

`@repo/db` — Prisma schema and generated client, imported by the backend via `workspace:*`.

Core models: **User**, **Project**, **SandboxPod**, **Message**, **ProjectFile**, **Connection** (see `packages/db/prisma/schema.prisma`). A project owns messages, files, and one sandbox pod; a user owns projects and OAuth connections (currently GitHub).

## Tech stack

- **Runtime / package manager:** Bun, npm workspaces (`apps/*`, `packages/*`)
- **Monorepo orchestration:** Turborepo
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, Zustand, Framer Motion
- **Backend:** Express, native `ws` WebSockets, Zod
- **AI:** Google Gemini (`@google/generative-ai`), OpenAI SDK
- **Sandboxing:** E2B, Dockerode
- **Data:** PostgreSQL via Prisma (`@repo/db`)
- **Auth:** JWT (`jsonwebtoken`) + `bcryptjs`
- **Integrations:** GitHub (OAuth connect + push)

## Getting started

```sh
bun install

# copy env files and fill in secrets (DB URL, JWT secret, Gemini/OpenAI keys, GitHub OAuth, E2B key)
cp apps/backend/.env.example apps/backend/.env   # if present, otherwise edit apps/backend/.env directly
cp apps/web/.env.example apps/web/.env

# run the Prisma migrations
bun run --cwd packages/db prisma migrate dev

# start everything (web + backend) in dev mode
turbo dev
```

Run a single app:

```sh
turbo dev --filter=web
turbo dev --filter=backend
```

Build everything:

```sh
turbo build
```

## Scripts (root)

| Script | Description |
|---|---|
| `bun run build` | `turbo run build` across all apps/packages |
| `bun run dev` | `turbo run dev` across all apps/packages |
| `bun run lint` | `turbo run lint` |
| `bun run check-types` | `turbo run check-types` |
| `bun run format` | Prettier over the whole repo |

## Notes

- The sandbox reaper in `apps/backend/src/index.ts` stops any `SandboxPod` that hasn't sent a heartbeat in 15 minutes, checked every 5 minutes — keep this in mind when debugging a sandbox that "disappeared."
- `apps/backend/template/` is the project scaffold cloned into a fresh sandbox for every new project; edit it to change what a brand-new project starts with.
- Environment variables live per-app (`apps/web/.env`, `apps/backend/.env`, `packages/db/.env`) rather than a single root `.env`.

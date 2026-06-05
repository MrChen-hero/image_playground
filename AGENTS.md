# GPT Image Playground Agent Notes

## Project Snapshot

- Stack: Vite, React 19, TypeScript, Tailwind CSS, Zustand, Vitest.
- Package manager: npm with `package-lock.json`; use `npm ci` for clean installs.
- App model: single-page app with state-driven views, no `react-router`.
- Runtime entry: `src/main.tsx`; app shell and modal mounting: `src/App.tsx`.
- Main state and workflows: `src/store.ts`; persistent binary/data storage: `src/lib/db.ts`.

## Commands

- Install: `npm ci`
- Dev server: `npm run dev`
- Mock image API: `npm run mock:api`
- Build: `npm run build`
- Tests: `npm test`
- Watch tests: `npm run test:watch`
- Preview: `npm run preview`
- Cloudflare deploy: `npm run deploy:cf`

Local mock API defaults to `http://127.0.0.1:8787`; see `docs/mock-image-api.md`.

In this managed Windows environment, `node`/`npm` may not be on PATH. Known host paths:

- `C:\Environment\nodejs\nodejs\node.exe`
- `C:\Environment\nodejs\nodejs\npm.cmd`

If normal npm commands fail with command-not-found, retry using the explicit `npm.cmd` path.

## App Views And Runtime Flow

- `src/App.tsx` selects the main view from `useStore((s) => s.appMode)`.
- `appMode === 'gallery'`: gallery search, task grid, and gallery favorite collections.
- `appMode === 'agent'`: `AgentWorkspace`.
- `appMode === 'square'`: `PromptSquare`; `InputBar` is intentionally hidden.
- Global modals are mounted from `App`: task detail, image lightbox, settings, confirm dialog, support prompt, gallery favorite modals, toast, mask editor, and image context menu.
- URL query settings are parsed in `src/lib/urlSettings.ts` and applied during `App` startup; recognized params are removed with `history.replaceState`.

## Core File Index

- `src/types.ts`: shared contracts for settings, tasks, images, Agent conversations, prompt square, and manifests.
- `src/store.ts`: Zustand store, task lifecycle, Agent workflow, imports/exports, favorites, image caches.
- `src/lib/db.ts`: IndexedDB schema, task/image/thumbnail/Agent/prompt-square stores.
- `src/lib/api.ts`: image provider dispatch.
- `src/lib/openaiCompatibleImageApi.ts`: OpenAI-compatible Images/Responses/custom provider logic.
- `src/lib/falAiImageApi.ts`: fal.ai provider logic.
- `src/lib/apiProfiles.ts`: settings defaults, profile normalization, provider switching.
- `src/lib/devProxy.ts`: local/deployment proxy URL behavior.
- `src/lib/promptSquare.ts`: prompt square normalization, import/export, favorite collection logic.
- `src/lib/paramOptions.ts`: shared parameter option limits used by prompt square and controls.
- `src/components/Header.tsx`: mode switcher and global header controls.
- `src/components/InputBar.tsx`: gallery/Agent prompt input, reference images, params, batch actions.
- `src/components/TaskGrid.tsx` and `src/components/TaskCard.tsx`: gallery grid and cards.
- `src/components/DetailModal.tsx` and `src/components/Lightbox.tsx`: gallery detail and reusable image preview behavior.
- `src/components/PromptSquare.tsx`: prompt square library, cards, edit modal, local favorite collections.
- `src/components/FavoriteCollections.tsx`: gallery favorite collection overview, picker, and management modal.
- `src/components/SettingsModal.tsx`: settings UI; intentionally large, keep edits narrow.

## Persistence

- Zustand persist key: `gpt-image-playground`.
- IndexedDB name: `gpt-image-playground`; current schema version: `5`.
- IndexedDB stores:
  - `tasks`
  - `images`
  - `thumbnails`
  - `agentConversations`
  - `promptSquareItems`
  - `promptSquareFavoriteCollections`
  - `promptSquareFavoriteMeta`
- Full images are stored by SHA-256 hash; thumbnails are separate and versioned by `CURRENT_THUMBNAIL_VERSION`.
- Prompt square favorites are independent from gallery task favorites. Do not reuse gallery `FavoriteCollection` or `TaskRecord.favoriteCollectionIds` for prompt square data.

## Configuration And Providers

- Built-in providers: `openai` and `fal`.
- Custom providers are normalized in `src/lib/apiProfiles.ts`.
- Active request profile is resolved with `getActiveApiProfile(settings)`.
- Build/runtime config keys include `VITE_DEFAULT_API_URL`, `VITE_API_PROXY_AVAILABLE`, `VITE_API_PROXY_LOCKED`, `VITE_DOCKER_DEPLOYMENT`, `DEFAULT_API_URL`, `API_PROXY_URL`, `ENABLE_API_PROXY`, and `LOCK_API_PROXY`.
- Local proxy config: `dev-proxy.config.json`, based on `dev-proxy.config.example.json`; Vite injects it as `__DEV_PROXY_CONFIG__`.

When adding or changing settings, update `AppSettings`, defaults/normalization, import/share behavior, settings UI, persistence/draft handling, and tests.

## Fork Behaviors To Preserve

- URL setting params must not reset existing API configuration when no recognized setting param is present.
- `settings.clearInputAfterSubmit` defaults to `true`.
- Reference image compression is wired through settings, preprocessing, upload/data URL call sites, and settings UI.
- Prompt square is a local maintainable library with independent import/export and favorite collections.

## Testing And Risk Areas

Run `npm test` and `npm run build` before merging substantial changes.

High-risk areas:

- `src/store.ts`: task lifecycle, timers, persistence, deletion cleanup, Agent branching.
- `src/lib/db.ts`: IndexedDB versioning, object store upgrades, image/thumbnail cleanup.
- `src/components/InputBar.tsx`: contentEditable selection, uploads, image mentions, mobile layout.
- `src/components/SettingsModal.tsx`: draft settings and profile normalization.
- `src/components/PromptSquare.tsx`: nested modals, scroll locking, prompt square import/export, local favorites.
- `src/lib/apiProfiles.ts`: backward compatibility for imported/shared configs.
- `src/lib/openaiCompatibleImageApi.ts`: provider compatibility and streaming/custom extraction.
- `deploy/*` and `vite.config.ts`: proxy, runtime env, deployment behavior.

Useful focused tests:

- `src/store.test.ts`
- `src/lib/db.promptSquare.test.ts`
- `src/lib/promptSquare.test.ts`
- `src/lib/apiProfiles.test.ts`
- `src/lib/urlSettings.test.ts`
- `src/lib/size.test.ts`
- `src/lib/mask*.test.ts`

## Git And Sync

- Fork remote: `origin` (`MrChen-hero/image_playground`).
- Upstream remote: `upstream` (`CookSleep/gpt_image_playground`).
- Avoid rebasing already-pushed `main` unless explicitly requested.
- For upstream syncs, use a backup branch and a dedicated sync branch, then fast-forward or merge into `main` after tests.
- Keep `package-lock.json` aligned with `package.json`.
- Local `.worktrees/` may exist for feature work; do not treat it as source code.

## Documentation Index

- User README: `README.md`
- Current design note: `DESIGN.md`
- Prompt square design: `docs/superpowers/specs/2026-06-06-prompt-square-maintainable-library-design.md`
- Mock API: `docs/mock-image-api.md`
- Custom provider prompt contract: `docs/custom-provider-llm-prompt.md`
- Vercel: `vercel.json`, `.github/workflows/vercel-tag-deploy.yml`
- Cloudflare Workers: `wrangler.jsonc`, `.github/workflows/deploy.yml`
- Docker: `deploy/Dockerfile`, `deploy/nginx.conf`, `.github/workflows/docker.yml`

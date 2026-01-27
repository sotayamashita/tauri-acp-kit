# Repository Guidelines

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in .agent/PLANS.md) from design to implementation

## Project Structure & Module Organization

- `src/` contains the React + TypeScript frontend. Entry point is `src/main.tsx`, with UI in `src/App.tsx` and styles in `src/App.css`.
- `src/assets/` holds bundled assets; `public/` contains static files copied as-is.
- `src/test/` contains test setup utilities (e.g., Testing Library + Vitest config and mocks).
- `src-tauri/` contains the Tauri (Rust) backend and config (`src-tauri/src/`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`).

## Build, Test, and Development Commands

Use pnpm from the repo root:

- `pnpm dev` — start the Vite dev server.
- `pnpm build` — typecheck then build the frontend.
- `pnpm preview` — serve the production build locally.
- `pnpm tauri dev` — run the Tauri app in dev mode.
- `pnpm tauri build` — build the Tauri app for release.
- `pnpm typecheck` — TypeScript checks without emitting.
- `pnpm lint` / `pnpm lint:fix` — run Oxlint (and auto-fix).
- `pnpm fmt` / `pnpm fmt:check` — run Oxc formatter.
- `pnpm test` / `pnpm test:run` — Vitest in watch or CI mode.
- `pnpm test:coverage` — run tests with coverage.

## Coding Style & Naming Conventions

- TypeScript + React components use `PascalCase` filenames (`App.tsx`), hooks use `use*`.
- Follow existing formatting; `oxfmt` and `oxlint` enforce style.
- The project uses ESM (`"type": "module"`), so prefer `import` syntax.

## Testing Guidelines

- Frameworks: Vitest + Testing Library + JSDOM; setup lives in `src/test/setup.ts`.
- Tests use `*.test.tsx` (e.g., `src/App.test.tsx`).
- Run `pnpm test:run` before submitting; add coverage with `pnpm test:coverage` when changing core logic.

## Commit & Pull Request Guidelines

- Commits must follow Conventional Commits and pass commitlint. Example: `feat: add diagram palette`.
- Commit messages may not include GitHub `@mentions` (enforced by commitlint).
- Pre-commit hooks (husky + lint-staged) run `secretlint`, `oxfmt`, `oxlint`, `pnpm typecheck`, and related tests.
- PRs should include: purpose, test commands run, and screenshots for UI changes. Link any relevant issues.

## Security & Configuration Tips

- Avoid committing secrets; `secretlint` runs automatically in pre-commit.
- Tauri configuration lives in `src-tauri/tauri.conf.json`; keep changes minimal and documented in the PR.

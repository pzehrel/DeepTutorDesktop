# Repository Guidelines

This guide applies repository-wide. Keep changes scoped to the relevant package and
follow the architecture in `docs/`. Chinese translation:
[AGENTS.zh-CN.md](AGENTS.zh-CN.md).

## Project Structure & Module Organization

- `frontend/` contains the React/Vite/TypeScript renderer in `frontend/src/`.
- `src-tauri/` contains the Tauri 2 Rust shell, capabilities, and icons.
- `bridge/` contains the Python stdio JSON-RPC package and tests (`bridge/src/`, `bridge/tests/`).
- `schemas/bridge/v1/` stores versioned protocol schemas; update these with protocol changes.
- `docs/` contains architecture, packaging, protocol, and ADR documentation.
- `runtime/` is a tracked placeholder; do not commit packaged runtimes, wheels, or user data.

## Build, Test, and Development Commands

Run `pnpm install` first:

- `pnpm dev` — start the Tauri desktop app in development.
- `pnpm dev:frontend` — run the Vite renderer alone at `127.0.0.1:1420`.
- `pnpm build` / `pnpm build:frontend` — build the Tauri app or renderer.
- `pnpm check` — run JavaScript and Python lint, formatting, typecheck, and tests.
- `pnpm test:bridge` — run the Python bridge test suite.

## Coding Style & Naming Conventions

Use `.editorconfig`: LF endings, two-space web indentation, and four-space Python/Rust indentation.
Run `pnpm lint` for ESLint (Antfu configuration). Python uses Ruff with double quotes, a
100-character limit, and strict Pyright checking. Use PascalCase for React components/types,
camelCase for TypeScript members, snake_case for Python, and standard Rust `snake_case`/`CamelCase`.
Keep generated `dist/`, `target/`, and `src-tauri/gen/` outputs out of commits.

## Documentation While Coding

When implementing, refactoring, or fixing code, read and follow
[write-code-docs](.agents/skills/write-code-docs/SKILL.md). Add behavior-accurate comments/docstrings
for non-obvious public or private behavior. Keep code comments English-first with Chinese in the same
block; keep Markdown languages in separate files. Validate claims against source/tests and run
applicable checks.

## Testing Guidelines

Name bridge tests `test_*.py` in `bridge/tests/`. Add protocol coverage alongside the implementation,
then run `pnpm test:bridge` or `pnpm check`. Add focused frontend/Rust tests when introducing
non-trivial behavior; none are defined yet.

## Commit & Pull Request Guidelines

Use short imperative commit subjects (for example, `Add runtime health command`) and keep commits
focused. Pull requests should explain the affected layer, link issues when applicable, list
verification commands, and include screenshots or recordings for renderer/UI changes. Update docs or
schemas when changing protocol or packaging behavior.

## Security & Configuration Tips

Preserve the stdio/NDJSON boundary: protocol messages belong on bridge stdout and diagnostics on
stderr. Do not add TCP listeners, expose arbitrary shell access to the renderer, or commit secrets,
signing files, or packaged runtime artifacts.

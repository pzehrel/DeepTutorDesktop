# DeepTutor Desktop

A Tauri desktop distribution layer that packages all of [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) into a single desktop app. Install one `.dmg` / `.exe` / `.deb`, with no preinstalled Python, Node.js, or DeepTutor — opening the app lands you in the full DeepTutor learning interface.

- **Embedded full stack**: python-build-standalone CPython + a pinned `deeptutor` PyPI wheel (which ships the built Next.js frontend) + an official Node.js binary, all bundled as application resources; upstream source is never copied or modified.
- **The complete interface**: on launch the Rust core starts `deeptutor start` (FastAPI backend + Next.js frontend) and, once it is ready, navigates the window into the DeepTutor web UI — chat, knowledge bases, visualizations, settings, and every other feature.
- **Theme and language follow**: the boot loader mirrors DeepTutor's four themes (snow / light / dark / glass, palettes extracted from its compiled assets); the first launch seeds Chinese or English from the OS language (everything non-Chinese gets English), and manual in-app switches are always respected afterwards.
- **stdio bridge kept alongside**: a zero-TCP stdio JSON-RPC protocol layer (`bridge/`) remains available for programmatic access to DeepTutor capabilities — see the [protocol docs](docs/protocol.md).
- **Clean lifecycle**: the embedded stack binds only to the loopback interface (ADR-0003); quitting the app gracefully stops every child process with no orphans.

## Install

Download the installer for your platform from GitHub Releases (published automatically by CI when a `v*` tag is pushed):

| Platform | Installer |
|---|---|
| macOS Apple Silicon | `DeepTutor-Desktop_<version>_macos-apple-silicon.dmg` |
| macOS Intel | `DeepTutor-Desktop_<version>_macos-intel.dmg` |
| Linux x64 | `DeepTutor-Desktop_<version>_linux-x64.deb` / `.AppImage` |
| Windows x64 | `DeepTutor-Desktop_<version>_windows-x64_setup.exe` |

First use requires configuring a model API key in DeepTutor's Settings before conversations can start. User data (configuration, knowledge bases, memory) lives in the OS application-data directory, never in the install directory.

## Architecture

```text
┌──────────────────────────────────────────────┐
│ DeepTutor Desktop (Tauri)                    │
│                                              │
│  Renderer (WebView)                          │
│    └ boot loader ──on ready──▶ DeepTutor Web │
│                                              │
│  Tauri Rust Core                             │
│    ├ embedded stack: deeptutor start/stop,   │
│    │ loopback readiness probe, theme/lang    │
│    └ stdio bridge (optional, programmatic)   │
│                                              │
│  Resources/runtime/                          │
│    ├ python/  CPython + deeptutor wheel      │
│    └ node/    Node.js                        │
└──────────────────────────────────────────────┘
              │ http://127.0.0.1 (loopback)
              ▼
    DeepTutor Web (FastAPI + Next.js)
```

Key decisions: [ADR-0001](docs/adr/0001-sidecar-stdio.md) (stdio bridge), [ADR-0002](docs/adr/0002-use-tauri.md) (choosing Tauri), [ADR-0003](docs/adr/0003-embedded-web-stack.md) (embedded web stack and the loopback exception). See the [architecture guide](docs/architecture.md) and the [packaging strategy](docs/packaging.md).

## Building from source

Requirements: [pnpm](https://pnpm.io), [uv](https://docs.astral.sh/uv/), a Rust toolchain, Node.js 22+.

```bash
pnpm install                    # frontend dependencies
scripts/build-runtime.sh        # build the embedded runtime (required once, ~800MB)
pnpm build                      # bundle .app / .dmg (output in src-tauri/target/release/bundle/)
```

`scripts/build-runtime.sh` supports four targets and must run on a matching architecture: `darwin-arm64`, `darwin-x64`, `linux-x64`, `win32-x64`. CI (`.github/workflows/build.yml`) builds all four automatically in a matrix.

## Development

```bash
pnpm check                      # JS/Python lint, typecheck, and all tests
cargo test                      # Rust unit tests (src-tauri)
pnpm test:bridge                # Python bridge tests
pnpm dev                        # run the desktop app in dev mode
```

In dev mode the Rust core resolves the embedded runtime via `DEEPTUTOR_RUNTIME_DIR` → the repository's `runtime/current`; the stdio bridge looks up `bridge/.venv` automatically. Environment overrides:

- `DEEPTUTOR_RUNTIME_DIR` — embedded runtime directory (containing `python/` and `node/`)
- `DEEPTUTOR_BRIDGE` / `DEEPTUTOR_BRIDGE_ARGS` — override the bridge executable and arguments

## Directory layout

```text
bridge/        # deeptutor-desktop-bridge (stdio JSON-RPC sidecar)
frontend/      # renderer (boot loader + Transport abstraction)
runtime/       # embedded runtime build output (gitignored, never committed)
scripts/       # runtime build and bundle-rename scripts
src-tauri/     # Tauri/Rust core (stack lifecycle + bridge + IPC)
schemas/       # bridge protocol v1 JSON Schemas
docs/          # architecture, protocol, packaging, and ADRs
.github/       # CI workflows
```

## Security boundary

- The embedded web stack binds only to `127.0.0.1` and is never exposed externally (the exception recorded in ADR-0003; the stdio bridge stays zero-TCP).
- The WebView renderer calls only allowlisted Tauri commands and holds no shell or subprocess capability.
- DeepTutor is consumed as a pinned external wheel dependency; this repository contains none of its source, and upstream upgrades must pass compatibility testing.

Localized version: [简体中文](README.zh-CN.md).

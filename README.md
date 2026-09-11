**English** | [简体中文](README.zh-CN.md)

<div align="center">

<img src="assets/branding/deeptutor-desktop-icon-1024.png" alt="DeepTutorDesktop logo" width="160">

# DeepTutorDesktop

The complete [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) learning platform, packaged as one desktop app.

Install a single `.dmg` / `.exe` / `.deb` — no Python, Node.js, or DeepTutor preinstalled — open the app, and land directly in the full DeepTutor interface: chat, knowledge bases, visualizations, and settings.

[Install](#install) · [Build from source](#building-from-source) · [Development](#development)

</div>

## Highlights

- **Embedded full stack** — python-build-standalone CPython, a pinned `deeptutor` PyPI wheel (which ships the built Next.js frontend), and an official Node.js binary, all bundled as application resources. Upstream source is never copied or modified.
- **The complete interface** — on launch the Rust core starts `deeptutor start` (FastAPI backend + Next.js frontend) and, once it is ready, navigates the window into the DeepTutor web UI.
- **Theme and language follow** — the boot loader mirrors DeepTutor's four themes (snow / light / dark / glass, palettes extracted from its compiled assets); first launch seeds Chinese or English from the OS language (everything non-Chinese gets English), and manual in-app switches are always respected afterwards.
- **stdio bridge kept alongside** — a zero-TCP stdio JSON-RPC protocol layer (`bridge/`) remains available for programmatic access; see the [protocol docs](docs/protocol.md).
- **Clean lifecycle** — quitting the app gracefully stops every background process; nothing is left running.

## Install

Download the installer for your platform from [GitHub Releases](https://github.com/pzehrel/DeepTutorDesktop/releases):

| Platform | Installer |
|---|---|
| macOS Apple Silicon | `DeepTutorDesktop_<version>_macos-apple-silicon.dmg` |
| macOS Intel | `DeepTutorDesktop_<version>_macos-intel.dmg` |
| Linux x64 | `DeepTutorDesktop_<version>_linux-x64.deb` / `.AppImage` |
| Windows x64 | `DeepTutorDesktop_<version>_windows-x64_setup.exe` |

First use requires configuring a model API key in DeepTutor's Settings before conversations can start. User data (configuration, knowledge bases, memory) lives in the OS application-data directory, never in the install directory.

## Building from source

Requirements: [pnpm](https://pnpm.io), [uv](https://docs.astral.sh/uv/), a Rust toolchain, and Node.js 22+.

```bash
pnpm install                    # frontend dependencies
scripts/build-runtime.sh        # build the embedded runtime (required once, ~800MB)
pnpm build                      # bundle .app / .dmg (output in src-tauri/target/release/bundle/)
```

`scripts/build-runtime.sh` supports four targets and must run on a matching architecture: `darwin-arm64`, `darwin-x64`, `linux-x64`, `win32-x64`.

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
assets/        # branding and logo artwork
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

- The embedded web stack binds only to `127.0.0.1` on your own machine and is never reachable from other devices.
- The WebView renderer calls only allowlisted Tauri commands and holds no shell or subprocess capability.
- DeepTutor is consumed as a pinned external wheel dependency; this repository contains none of its source, and upstream upgrades must pass compatibility testing.

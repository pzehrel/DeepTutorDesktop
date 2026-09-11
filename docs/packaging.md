# Runtime and Tauri packaging strategy

## 1. Build inputs

Each target platform builds its own runtime artifact, produced by `scripts/build-runtime.sh <target>` on a machine **matching the target architecture**:

```text
runtime/<target>/          # canonical directory, kept for inspection
runtime/current/           # the path actually packed by tauri.conf.json `bundle.resources`
├── python/                # relocatable CPython (python-build-standalone) + deeptutor wheel and deps
└── node/                  # official Node.js binary (needed by deeptutor_web's Next.js server)
```

Supported targets: `darwin-arm64`, `darwin-x64` (Intel), `linux-x64`, `win32-x64`.

DeepTutor is always installed into the runtime as a pinned PyPI wheel (`deeptutor==<version>`); this repository never copies or modifies its source (see ADR-0003). Build outputs are mapped into application resources via Tauri `bundle.resources` (`Resources/runtime/`) and never committed to Git.

## 2. CI packaging

GitHub Actions (`.github/workflows/build.yml`) builds a four-runner matrix: macos-14 (Apple Silicon), macos-13 (Intel), ubuntu-22.04, and windows-latest. Artifacts are named per platform/architecture, and pushing a `v*` tag automatically creates a Release:

```text
DeepTutor-Desktop_<version>_macos-apple-silicon.dmg
DeepTutor-Desktop_<version>_macos-intel.dmg
DeepTutor-Desktop_<version>_linux-x64.deb / .AppImage
DeepTutor-Desktop_<version>_windows-x64_setup.exe
```

Intel and Apple Silicon macOS packages use distinct filenames and can never be confused. Local `pnpm build` produces identically named outputs via the `postbuild` hook (`scripts/rename-bundles.mjs`).

## 3. Build principles

- pin the `deeptutor` version and its dependency lock;
- build on the target architecture; never copy a host venv to another architecture;
- never commit runtimes, wheelhouses, or large binaries to Git;
- TODO (unimplemented): macOS codesign / notarization, SHA-256 checksums attached to Releases.

## 4. In-app resource layout

The runtime does not use Tauri `externalBin`; it is packed wholesale as resources:

```text
DeepTutor Desktop.app/Contents/Resources/runtime/
├── python/    # bin/python3 + site-packages (deeptutor and deeptutor_web included)
└── node/      # official Node.js distribution (bin/node)
```

At runtime the Rust Core resolves the runtime directory in this order: the `DEEPTUTOR_RUNTIME_DIR` environment variable → application resources (packaged mode) → the repository's `runtime/` directory (development mode). Child processes are spawned with `node/bin` prepended to `PATH` and `DEEPTUTOR_HOME` pointing at the application data directory.

The application install directory is read-only. Runtime configuration, logs, memory, knowledge bases, and generated files must live in Tauri's application data directory (`app_data_dir`). The WebView renderer gets no generic shell capability.

## 5. First-release packaging choice

The first release uses an "embedded Python runtime + wheel". Rationale: DeepTutor relies on dynamic imports, optional providers, and resource files, so keeping plain Python package semantics is more compatibility-friendly than PyInstaller.

PyInstaller remains a possible later optimization, at the cost of maintaining hidden imports, package data, native extensions, and multi-architecture builds.

## 6. Update strategy

The desktop shell and the agent runtime are versioned separately:

```text
desktop_version: 0.1.0
agent_version: 1.6.6
protocol_version: 1
```

Any agent runtime upgrade must pass compatibility testing before entering a desktop release.

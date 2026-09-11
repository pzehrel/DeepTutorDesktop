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

GitHub Actions (`.github/workflows/build.yml`) builds a matrix of macos-14 (Apple Silicon), macos-15-intel (Intel) and windows-latest; the Linux job is paused for now (deb/rpm bundling worked, AppImage did not). Artifacts are named per platform/architecture.

Pushing a `v<version>` tag is the whole release procedure: the `version` job writes that version into every manifest via `scripts/set-version.ts` and commits it to main (with `[skip ci]`), the build matrix builds that commit, and the `release` job cuts both changelogs, pushes them back to main, and publishes a GitHub Release:

```text
DeepTutorDesktop_<version>_macos-apple-silicon.dmg
DeepTutorDesktop_<version>_macos-intel.app.zip
DeepTutorDesktop_<version>_windows-x64_setup.exe
```

Intel ships the zipped `.app` rather than a dmg: creating a dmg image of the ~890MB, 68k-file bundle on the Intel runner either took ~10 minutes or died in `hdiutil detach` ("timeout for DiskArbitration expired"), while `ditto -c -k` produces the same payload in a minute or two without touching `hdiutil`.

Intel and Apple Silicon macOS packages use distinct filenames and can never be confused. Local `pnpm build` keeps Tauri's default bundle names (`<productName>_<version>_<arch>.<ext>`, e.g. `DeepTutorDesktop_0.0.1_aarch64.dmg`); only CI artifacts get the platform-explicit names above.

## 3. Build principles

- pin the `deeptutor` version and its dependency lock;
- build on the target architecture; never copy a host venv to another architecture;
- never commit runtimes, wheelhouses, or large binaries to Git;
- TODO (unimplemented): macOS codesign / notarization, SHA-256 checksums attached to Releases.

## 4. In-app resource layout

The runtime does not use Tauri `externalBin`; it is packed wholesale as resources:

```text
DeepTutorDesktop.app/Contents/Resources/runtime/
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

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
DeepTutorDesktop_<version>_macos-arm64.dmg
DeepTutorDesktop_<version>_macos-x64.app.zip
DeepTutorDesktop_<version>_windows-x64_setup.exe
```

Intel ships the zipped `.app` rather than a dmg: creating a dmg image of the ~890MB, 68k-file bundle on the Intel runner either took ~10 minutes or died in `hdiutil detach` ("timeout for DiskArbitration expired"), while `ditto -c -k` produces the same payload in a minute or two without touching `hdiutil`.

The two macOS packages use distinct filenames and can never be confused. The `platform` label of the build matrix feeds names only — artifacts, packages, and the job title — and selects neither the runner (`os` does) nor the architecture (the runner's own host does), so it is a naming choice rather than a build input. Its values follow the community `{os}-{arch}` asset convention with `arm64`/`x64` tokens — `macos-arm64`, `macos-x64`, the unchanged `windows-x64`, and `linux-x64` for the paused Linux job. Those are the tokens most macOS and Windows projects publish (`AFFiNE-…-macos-arm64.dmg`, `PowerToysSetup-…-x64.exe`), and they line up with the runtime target ids (`darwin-arm64`, `win32-x64`) and with Tauri's own default tokens (`aarch64`, `x64`). Branding words such as `apple-silicon`/`intel` are avoided deliberately: tooling cannot map them to an architecture, so every consumer would need its own lookup table. Local `pnpm build` keeps Tauri's default bundle names (`<productName>_<version>_<arch>.<ext>`, e.g. `DeepTutorDesktop_0.0.1_aarch64.dmg`); only CI artifacts get the platform-explicit names above.

## 3. Build principles

- pin the `deeptutor` version and its dependency lock;
- build on the target architecture; never copy a host venv to another architecture;
- never commit runtimes, wheelhouses, or large binaries to Git;
- macOS bundles are ad-hoc signed, so Gatekeeper's signature check passes (see §7);
- still TODO (unimplemented): Developer ID signing / notarization, SHA-256 checksums attached to Releases.

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

## 7. macOS code signing and Gatekeeper

`src-tauri/tauri.conf.json` sets `bundle.macOS.signingIdentity: "-"`, which makes Tauri ad-hoc sign the `.app` while bundling. No Apple Developer account is involved and the signature carries no team identity — but it does create a **seal**, and that seal is the only thing Gatekeeper inspects on first launch.

Without it, the `.app` inherits just the ad-hoc signature Rust's linker stamps into the Mach-O executable. A linker signature declares a resource envelope, yet no `Contents/_CodeSignature/CodeResources` is ever written for the bundle, so validation always fails:

```console
$ codesign --verify --deep --strict DeepTutorDesktop.app
DeepTutorDesktop.app: code has no resources but signature indicates they must be present

$ spctl -a -vvv -t exec DeepTutorDesktop.app
DeepTutorDesktop.app: code has no resources but signature indicates they must be present
```

macOS only runs that check on a quarantined bundle, and a browser-downloaded dmg sets `com.apple.quarantine` on every file it extracts. When the check fails the user sees the misleading **"DeepTutorDesktop.app is damaged and can't be opened. You should move it to the Trash."** The payload is intact; only the signature is broken — which is why the same `.app` launches fine straight off the mounted dmg volume, where no file is quarantined.

Ad-hoc signing fixes the failure without removing the warning: `codesign --verify --deep --strict` then exits 0, and Gatekeeper falls back to the ordinary "Apple cannot check it for malicious software" rejection, which the user can accept via right-click → Open or System Settings → Privacy & Security → Open Anyway. The unbootable "damaged" dialog stops appearing. Tauri's default hardened runtime stays enabled; an ad-hoc signature with `--options runtime` still resolves and loads the embedded CPython extension modules, verified by launching the signed bundle and watching uvicorn come up.

Release artifacts published before this signing was added can be rescued by dropping the quarantine flag, which is the entire obstacle when the bundle itself is intact:

```bash
xattr -rd com.apple.quarantine /Applications/DeepTutorDesktop.app
```

This is a local workaround, not a distribution strategy: it only suppresses the first-launch check and still leaves an untrusted signature executing.

Removing the warning outright requires **Developer ID signing + notarization**, which is not a one-line config change. It needs a paid Apple Developer account plus CI secrets (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, and either `APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID` or `APPLE_API_KEY` + `APPLE_API_ISSUER`), and notarization validates every nested Mach-O in the bundle. This bundle embeds an upstream CPython and Node.js distribution under `Contents/Resources/runtime/` (~68k files), so its executables, `.dylib`, and `.so` files must each be signed with the Developer ID before the outer bundle is sealed. Apple deprecates `--deep`, so it cannot be relied on for that pass.

The bytecode cache is the one runtime write that must not land inside the bundle. Left at its default the embedded CPython compiles bytecode **into** the app, writing `__pycache__/*.pyc` under `Contents/Resources/runtime/python/lib/python3.13/`, which breaks the resource seal:

```console
$ codesign --verify DeepTutorDesktop.app
DeepTutorDesktop.app: a sealed resource is missing or invalid
file added: .../runtime/python/lib/python3.13/encodings/__pycache__/idna.cpython-313.pyc.4442832944
```

An ad-hoc signed bundle survives one such break: Gatekeeper assesses the app before it runs, and LaunchServices drops the quarantine flag after the first success, so later launches are not re-checked. A notarized bundle is not so forgiving — macOS re-assesses notarized apps and rejects one whose sealed resources have changed.

The desktop shell therefore sets `PYTHONPYCACHEPREFIX` to `<app-data>/deeptutor/pycache` on every CLI spawn (`run_cli` in `src-tauri/src/stack.rs`); the launcher's uvicorn and Node children inherit it. The interpreter keeps caching bytecode across launches, the bundle stays byte-identical to what Tauri signed, and `codesign --verify` passes after any number of runs. The redirect makes the `.pyc` files shipped inside `runtime/current` inert (Python reads the cache only from the prefix), so the first launch after this change recompiles into the new location — measured at ~12 s to backend-ready versus ~3 s warm, a one-time cost per installation. §4's "the application install directory is read-only" now actually holds.

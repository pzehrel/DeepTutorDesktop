# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **packaging:** ad-hoc sign the macOS bundle for Gatekeeper (`c2bbc3c`)
- **shell:** keep the bytecode cache out of the signed bundle (`e0ff98d`)
- **shell:** read the ready port from the launcher's marker (`811e96d`)
## [0.0.1] - 2026-09-11

### Added
- **release:** automate bilingual changelog and adopt conventional commits (`befc703`)
- **shell:** pin embedded stack to high loopback ports (`b24f816`)
- DeepTutor Desktop shell (Tauri 2) with Python stdio JSON-RPC bridge
  integration and versioned protocol schemas under `schemas/bridge/v1/`.
- Embedded the full DeepTutor web stack behind the desktop shell, with
  `DEEPTUTOR_HOME` set for embedded CLI invocations.
- Boot loader mirroring DeepTutor's interface theme during startup.
- Multi-platform packaging with GitHub Actions builds and one installer per
  platform, renamed to product names.
- App icon set and the v3 brand mark.
- First-launch language selection that follows the OS language.
- User-facing README and architecture, packaging, and protocol docs with
  English canonical and zh-CN counterparts.

### Changed

- Renamed the product to DeepTutor Desktop.

- **packaging:** upgrade embedded deeptutor to 1.6.7 (`f262680`)
- **shell:** adopt the official DeepTutor mark for the app icon and loader (`48e5183`)
### Fixed
- **release:** fail when a tag would move the version backwards (`99855e1`)
- **release:** reassemble wrapped zh-CN subjects (`2732d79`)
- **release:** preserve blank lines inside hand-written changelog prose (`14b90b8`)
- **release:** keep hand-written changelog prose and stdout clean (`145247b`)
- **release:** cut the changelog for the version actually being released (`98d83ef`)
- **ci:** drop the invalid --bundles all override (`8765d3d`)
- **ci:** invoke tauri directly so --bundles reaches the tauri CLI (`84dd9d2`)
- **ci:** move macos-intel from retired macos-13 to macos-15-intel (`b051aeb`)
- **ci:** stop YAML folding from commenting out the libfuse2 arg (`1011da6`)
- **ci:** copy runtime/current with cp instead of PowerShell on Windows (`2ff2453`)
- **ci:** also remove the Windows EXTERNALLY-MANAGED marker (`ad35fa6`)
- **ci:** locate uv's Windows python install via uv python dir (`873aae7`)
- **ci:** unblock windows runtime build and linux AppImage bundling (`b3a4c67`)

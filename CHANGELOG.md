# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Nothing notable yet.

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

### Fixed
- **release:** reassemble wrapped zh-CN subjects (`2732d79`)
- **release:** preserve blank lines inside hand-written changelog prose (`14b90b8`)
- **release:** keep hand-written changelog prose and stdout clean (`145247b`)
- **release:** publishing v0.0.1 was blocked by two changelog defects — the release tag counted as its own predecessor (empty commit range) and a hand-written `[Unreleased]` section refused to release (`98d83ef`)

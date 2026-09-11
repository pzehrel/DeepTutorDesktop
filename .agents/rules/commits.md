# Commit Message Rules

Applies to every commit in this repository, including commits made by agents.
Chinese translation: [commits.zh-CN.md](commits.zh-CN.md).

## Format

Every commit subject MUST follow [Conventional Commits](https://www.conventionalcommits.org/)
with a bilingual body trailer:

```
<type>(<scope>)!: <English imperative subject>

zh-CN: <Chinese subject>
```

- `type` — one of `feat`, `fix`, `perf`, `refactor`, `docs`, `build`, `ci`,
  `test`, `chore`, `style`.
- `scope` — optional, the affected layer: `bridge`, `shell`, `frontend`,
  `packaging`, `release`, `docs`, or omit when truly cross-cutting.
- `!` — mark breaking changes (or add a `BREAKING CHANGE:` footer with details).
- English subject: short, imperative, lowercase after the type prefix.
- `zh-CN:` body line: REQUIRED. One line, a complete standalone Chinese
  subject (no `scope:` prefix inside it — the changelog renders the scope
  separately).

## Why

`scripts/update-changelog.ts` parses these subjects to maintain
`CHANGELOG.md` and `CHANGELOG.zh-CN.md` automatically:

- `feat` → Added, `refactor` → Changed, `perf` → Performance, `fix` → Fixed;
- `docs`/`build`/`ci`/`test`/`chore`/`style` are excluded from the changelog;
- commits without a conventional subject are excluded and reported as skipped;
- commits without the `zh-CN:` trailer fall back to the English subject in the
  Chinese changelog.

## Examples

```
feat(bridge): add runtime health check

zh-CN: 新增运行时健康检查
```

```
feat(shell)!: embed full web stack behind the desktop shell

zh-CN: 将完整 Web 技术栈嵌入桌面外壳

BREAKING CHANGE: the bridge protocol envelope now requires v1 schemas.
```

## Verification

Run `pnpm changelog` after committing: your entry must appear in the
`[Unreleased]` section of both changelog files, and stderr must not list your
commit among the skipped ones.

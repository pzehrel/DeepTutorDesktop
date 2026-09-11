# 提交信息规则

适用于本仓库的所有提交，包括 agent 产生的提交。英文原文：
[commits.md](commits.md)。

## 格式

每条提交主题必须遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-cn/)，
并在正文携带双语 trailer：

```
<type>(<scope>)!: <英文祈使句主题>

zh-CN: <中文主题>
```

- `type` — 取 `feat`、`fix`、`perf`、`refactor`、`docs`、`build`、`ci`、
  `test`、`chore`、`style` 之一。
- `scope` — 可选，表示受影响的层：`bridge`、`shell`、`frontend`、
  `packaging`、`release`、`docs`；确实跨层时省略。
- `!` — 标记破坏性变更（或添加 `BREAKING CHANGE:` 页脚说明详情）。
- 英文主题：简短、祈使句、type 前缀之后小写开头。
- `zh-CN:` 正文行：必需。单行、完整的中文主题（不要在行内重复 `scope:`
  前缀 —— changelog 会单独渲染 scope）。

## 原因

`scripts/update-changelog.ts` 解析这些主题，自动维护 `CHANGELOG.md` 与
`CHANGELOG.zh-CN.md`：

- `feat` → 新增，`refactor` → 变更，`perf` → 性能，`fix` → 修复；
- `docs`/`build`/`ci`/`test`/`chore`/`style` 不进入 changelog；
- 不符合规范的提交会被排除，并在 stderr 中报告为 skipped；
- 缺少 `zh-CN:` trailer 的提交在中文 changelog 中回退使用英文主题。

## 示例

```
feat(bridge): add runtime health check

zh-CN: 新增运行时健康检查
```

```
feat(shell)!: embed full web stack behind the desktop shell

zh-CN: 将完整 Web 技术栈嵌入桌面外壳

BREAKING CHANGE: the bridge protocol envelope now requires v1 schemas.
```

## 验证

提交后运行 `pnpm changelog`：条目必须出现在两份 changelog 的
`[Unreleased]` 小节中，且 stderr 的 skipped 列表不得包含你的提交。

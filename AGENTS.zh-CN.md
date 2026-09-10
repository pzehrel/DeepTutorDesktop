# 仓库指南

本指南适用于整个仓库。将更改限制在相关包内，并遵循 `docs/` 中的架构说明。供人工审阅的中文翻译就是本文件；英文规范见
[AGENTS.md](AGENTS.md)。

## 项目结构与模块组织

- `frontend/` 包含 React/Vite/TypeScript 渲染器（位于 `frontend/src/`）。
- `src-tauri/` 包含 Tauri 2 Rust shell、capabilities 和图标。
- `bridge/` 包含 Python stdio JSON-RPC 包和测试（`bridge/src/`、`bridge/tests/`）。
- `schemas/bridge/v1/` 存放版本化协议 schema；更改协议时同步更新。
- `docs/` 包含架构、打包、协议和 ADR 文档。
- `runtime/` 是受 Git 跟踪的占位目录；不要提交已打包的 runtime、wheel 或用户数据。

## 构建、测试与开发命令

先运行 `pnpm install`：

- `pnpm dev` — 在开发模式启动 Tauri 桌面应用。
- `pnpm dev:frontend` — 单独运行 Vite 渲染器，地址为 `127.0.0.1:1420`。
- `pnpm build` / `pnpm build:frontend` — 构建 Tauri 应用或渲染器。
- `pnpm check` — 运行 JavaScript 和 Python 的 lint、格式检查、类型检查及测试。
- `pnpm test:bridge` — 运行 Python bridge 测试套件。

## 代码风格与命名约定

遵循 `.editorconfig`：使用 LF 换行，Web 文件缩进 2 个空格，Python/Rust 缩进 4 个空格。运行 `pnpm lint` 执行 ESLint（Antfu 配置）。Python 使用 Ruff：双引号、100 字符行宽和严格的 Pyright 检查。React 组件/类型使用 PascalCase，TypeScript 成员使用 camelCase，Python 使用 snake_case，Rust 遵循标准的 `snake_case`/`CamelCase`。不要将生成的 `dist/`、`target/` 和 `src-tauri/gen/` 输出提交到 Git。

## 编写代码时的文档

实现、重构或修复代码时，阅读并遵循 [write-code-docs](.agents/skills/write-code-docs/SKILL.md)。为不明显的公共或私有行为添加准确反映实际行为的注释/文档字符串。代码注释先写英文，再在同一注释块中写中文；Markdown 的两种语言分置于不同文件。根据源码/测试校验声明，并运行适用的检查。

## 测试指南

将 bridge 测试命名为 `test_*.py` 并放在 `bridge/tests/`。在实现旁添加协议覆盖，然后运行 `pnpm test:bridge` 或 `pnpm check`。引入非平凡行为时添加针对性的前端/Rust 测试；目前尚未定义这类测试套件。

## 提交与拉取请求指南

使用简短的祈使句提交主题（例如 `Add runtime health command`），并让提交保持单一目的。拉取请求应说明受影响的层、在适用时关联 issue、列出验证命令，并为渲染器/UI 更改附上截图或录屏。更改协议或打包行为时更新相关文档或 schema。

## 安全与配置提示

保持 stdio/NDJSON 边界：协议消息写入 bridge stdout，诊断信息写入 stderr。不要添加 TCP 监听器、向渲染器开放任意 shell 权限，也不要提交机密信息、签名文件或已打包的 runtime 产物。

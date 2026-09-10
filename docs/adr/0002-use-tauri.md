# ADR-0002：Desktop Shell 采用 Tauri

- 状态：Accepted
- 日期：2026-09-09
- 适用范围：DeepTutor Desktop

## 背景

桌面端需要自包含分发 DeepTutor、避免本地 TCP 端口，并保持 agent package 与桌面壳解耦。Electron 和 Tauri 都能够管理 sidecar，但本项目优先考虑较小的桌面运行时、明确的权限模型以及 Rust 主进程对 sidecar 生命周期的集中管理。

## 决策

Desktop Shell 采用 Tauri：

- WebView Renderer 负责界面；
- Rust Core 负责 commands/events、sidecar 生命周期和应用路径；
- DeepTutor Bridge 作为 Tauri `externalBin` 随应用分发；
- Rust Core 与 bridge 通过 stdin/stdout NDJSON JSON-RPC 通信；
- 不启动 localhost HTTP/WebSocket 服务；
- Tauri capabilities 只允许启动固定的 bridge sidecar，不开放通用 shell 权限。

## 原因

- sidecar 是本项目的核心运行方式，Tauri 对 external binary 有明确的打包和权限配置；
- agent 运行在独立 Python runtime 中，不要求将 Python 嵌入 Rust 进程；
- WebView、Rust Core 和 sidecar 形成清晰的最小权限边界；
- 应用无需携带 Electron 自带的 Chromium/Node runtime；
- stdio bridge 与具体 UI 框架解耦，未来仍可迁移。

## 代价

- 需要维护少量 Rust 代码；
- 需要为每个目标 triple 构建并签名 bridge/runtime；
- 现有 DeepTutor Next.js 前端不能原样依赖本地服务，需要提供 Tauri IPC transport，或改造成可嵌入的静态前端；
- Tauri 不解决 Python runtime 自身的依赖打包问题，该部分仍需独立构建流水线。

## 约束

在该决策被新的 ADR 取代前，不新增 Electron 工程、Electron Builder 配置或 Electron 专用 bridge API。

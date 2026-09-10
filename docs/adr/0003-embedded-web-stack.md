# ADR-0003：内嵌完整 DeepTutor Web 栈并允许回环 HTTP

- 状态：Accepted
- 日期：2026-09-10
- 适用范围：DeepTutor Desktop 的完整应用分发
- 关系：修订 ADR-0001 中“agent 不监听 TCP 端口”的约束；stdio bridge（ADR-0001）继续保留用于协议化访问。

## 背景

ADR-0001 采用 stdio bridge 的前提是桌面壳只需要编程式访问 DeepTutor 能力。但产品目标是交付完整的 DeepTutor 学习界面：打开应用即是 Web UI（会话、知识库、可视化、设置等）。该界面由 DeepTutor 官方 wheel 内置的 Next.js 前端（`deeptutor_web`）与 FastAPI 后端组成，两者只讲 HTTP/WebSocket，没有 stdio 形态。

## 决策

1. 构建阶段将锁定版本的官方 `deeptutor` wheel 安装进内嵌 Python runtime（python-build-standalone），连同 Node.js 官方二进制一起作为 Tauri resources 打包（见 `docs/packaging.md`）；
2. Rust Core 在应用数据目录下运行 `deeptutor start --detach --no-browser`，读取 home 目录 `system.json` 中记录的端口，等待回环地址就绪后将窗口导航到前端 URL；
3. 后端与前端只绑定 `127.0.0.1`，端口由 launcher 管理，应用退出时调用 `deeptutor stop` 优雅关闭；
4. 本项目不复制、不修改 DeepTutor 源码；DeepTutor 始终作为固定版本的外部依赖（PyPI wheel）消费。

## 与 ADR-0001 约束的关系

ADR-0001 禁止 TCP 监听的动机是“不向本机其他进程暴露 agent”。完整 Web UI 无法满足该约束，本 ADR 将其修订为：**仅允许 launcher 绑定回环地址的例外**，并保留 stdio bridge（ADR-0001、`bridge/`）作为协议化、无 TCP 的访问通道，二者并存。

## 代价

- 本机同用户的其他进程理论上可以访问回环端口（与浏览器访问 localhost 同级风险）；
- 分发体积显著增大（Python + Node + wheel 约数百 MB）；
- 需要 CI 为每个目标平台构建 runtime。

## 未选择的方案

### 把 Next.js 前端改造成静态资源嵌入 WebView

需要 fork DeepTutor 前端并把 API 层改写为 bridge 协议，违反“不耦合上游源码”的边界，且随上游版本频繁失效。

### 用浏览器打开前端、Tauri 仅作启动器

体验退化为“打开网页”，不满足“安装一个桌面应用即可使用”的目标。

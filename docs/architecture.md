# DeepTutor Desktop 架构

## 1. 范围

本项目是桌面分发层，不复制或修改 DeepTutor agent 的业务源码。DeepTutor 作为外部版本化依赖，由桌面应用在构建阶段打包进最终应用。

本项目不承担以下职责：

- 重写 DeepTutor 的 tools、capabilities 或 provider 实现；
- 在 Tauri/Rust 中直接绑定 DeepTutor 的内部 Python 模块；
- 让 agent 暴露给本机其他程序或外部网络（内嵌 Web 栈仅绑定回环地址，见 ADR-0003）；
- 把用户配置、记忆、知识库写入应用安装目录。

## 2. 分层

### 2.1 Tauri Desktop Shell

Tauri Rust Core 负责：

- 创建窗口和管理生命周期；
- 启动、监控和终止内嵌 DeepTutor 全栈（`deeptutor start --detach`，就绪探测后把窗口导航到回环前端 URL，退出时优雅停止）；
- 启动、监控和终止 stdio bridge 子进程（编程式协议访问）；
- 为 WebView Renderer 暴露最小化的 Tauri commands/events；
- 管理应用级路径，并在首次启动时按系统语言/主题预置 `interface.json`；
- 将 bridge 的结构化事件转发给 Renderer。

Tauri Rust Core 不应调用 DeepTutor 的 Python 内部实现。

### 2.2 Renderer / Frontend

Renderer 负责界面和交互，不直接访问 Python、文件系统或子进程。

前端使用抽象 transport：

```text
Transport
├── WebTransport       # 未来的浏览器/Web 部署
└── TauriTransport     # Desktop IPC
```

桌面版通过 Tauri command allowlist 暴露的白名单 API 调用 agent。

### 2.3 Desktop Bridge

Bridge 是独立的 Python package/可执行 sidecar，负责：

- 从 stdin 读取 JSON-RPC 请求；
- 调用 DeepTutor 的公开 SDK 或稳定入口；
- 将结果、流式事件和错误写入 stdout；
- 处理取消、超时和优雅退出；
- 不监听 TCP 端口。

Bridge 不属于 DeepTutor agent 源码仓库的内部模块。它只通过版本化依赖使用 DeepTutor。

### 2.4 DeepTutor 当前入口

DeepTutor 当前提供 Python SDK、CLI 和 HTTP/WebSocket API，但没有原生的 stdio JSON-RPC server。Bridge 的职责就是把桌面协议转换为 DeepTutor 的公开入口：

```text
Desktop JSON-RPC
        ↓
Desktop Bridge
        ↓
DeepTutorApp / TurnRequest / stream_turn
```

优先使用 `DeepTutorApp` Python SDK，因为它是进程内 async facade，可以直接访问 turn、session 和流式事件。`deeptutor run --format json` 可作为简单的一次性或诊断 fallback，但它输出的是 NDJSON stream，不等同于本项目的 JSON-RPC 协议。完整 Web UI 通过内嵌栈以回环 HTTP 提供（ADR-0003）；stdio bridge 则服务于协议化、无 TCP 的编程访问。

### 2.5 Agent Runtime

Agent runtime 由以下内容组成：

- 独立 Python runtime（python-build-standalone）；
- 固定版本的 `deeptutor` wheel（含 `deeptutor_web` 前端产物）；
- Node.js 官方二进制（Next.js standalone server 依赖）；
- DeepTutor 所需的运行时资源和可选依赖。

Runtime 是桌面应用的构建输入，不提交到 Git 仓库。

## 3. 进程和数据流

```mermaid
sequenceDiagram
    participant R as Renderer（加载页 → DeepTutor Web UI）
    participant M as Tauri Rust Core
    participant S as 内嵌全栈（deeptutor start）
    participant B as Desktop Bridge（可选）

    M->>S: deeptutor start --detach（DEEPTUTOR_HOME = 应用数据目录）
    S-->>M: system.json 记录端口 / 回环就绪
    M-->>R: deeptutor://state（ready + URL）
    R->>R: 窗口导航到 http://127.0.0.1:<port>（ADR-0003）

    opt 编程式协议访问
        R->>M: Tauri command
        M->>B: JSON-RPC request via stdin
        B-->>M: JSON-RPC response / stream event via stdout
        M-->>R: allowlisted command response/event
    end
```

## 4. 安全边界

- 内嵌 Web 栈仅绑定回环地址（`127.0.0.1`），不对外暴露；这是 ADR-0003 对最初"无 TCP"约束的正式修订，stdio bridge 仍保持零 TCP。
- WebView Renderer 只调用明确注册的 Tauri commands/events。
- Tauri capabilities 只授权固定的 sidecar、参数和资源，不开放任意 shell。
- Bridge 的 stdin/stdout 使用 NDJSON；日志写入 stderr，不污染协议流。
- 用户数据目录与应用资源目录分离。
- 所有外部文件、命令和 provider 配置能力继承 DeepTutor 自身的安全策略。

## 5. 版本策略

桌面构建必须固定 agent 版本，不直接依赖 DeepTutor 的 `main` 分支。

建议记录：

```text
agent_package: deeptutor
agent_version: <pinned version>
bridge_protocol: 1
runtime_target: darwin-arm64 | darwin-x64 | win32-x64 | linux-x64
artifact_sha256: <release artifact hash>
```

Bridge 协议和 agent package 版本分别管理。agent 的内部模块变更不能直接成为 Desktop 的 API。

## 6. 后续演进

完整界面走内嵌回环 Web 栈（ADR-0003），协议化访问走 stdio JSON-RPC（ADR-0001）。后续只有在性能或多端复用确实需要时，才考虑 Unix Domain Socket、named pipe 等替代传输。

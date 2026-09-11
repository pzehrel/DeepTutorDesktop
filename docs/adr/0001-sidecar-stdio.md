# ADR-0001：使用 sidecar 与 stdio JSON-RPC

- 状态：Accepted（"不监听 TCP"约束已被 [ADR-0003](0003-embedded-web-stack.md) 就内嵌 Web 栈修订；bridge 部分继续有效）
- 日期：2026-09-09
- 适用范围：stdio bridge 与协议化访问

## 背景

桌面应用需要把 DeepTutor agent 随 Tauri 一起分发，但不希望：

- 将 agent 源码复制进 Tauri 项目；
- 要求用户单独安装 Python 或执行 pip 安装；
- 开放本机 HTTP/WebSocket 端口；
- 让本机其他程序能够直接调用 agent。

`127.0.0.1` 只能限制网络范围，不能限制本机其他进程。因此 localhost API 不满足本项目的进程隔离目标。

DeepTutor 当前已经提供 Python SDK、CLI JSON/NDJSON 输出和 HTTP/WebSocket API，但没有直接面向 stdin/stdout 的 JSON-RPC server。因此需要单独的 Desktop Bridge 做协议适配，而不是把 JSON-RPC 支持硬塞进 agent 核心。

## 决策

采用独立的 Desktop Bridge sidecar：

1. 构建阶段将固定版本的 DeepTutor package 放入 embedded Python runtime；
2. Tauri Rust Core 启动 bridge sidecar；
3. Tauri 与 bridge 通过 stdin/stdout 传输 NDJSON JSON-RPC；
4. Renderer 只通过 Tauri commands/events 调用 bridge；
5. agent 不监听 TCP 端口。

## 结果

### 优点

- agent 与桌面层通过 package 和协议解耦；
- 没有可被浏览器或其他本地程序扫描的 TCP API；
- 用户无需安装 Python、Node.js 或 DeepTutor；
- Bridge 与 Tauri 独立版本化，未来也可被其他 desktop shell 复用；
- agent、bridge、桌面壳可以分别版本化。

### 代价

- 前端不能直接复用只依赖 HTTP/WebSocket 的 transport，需要增加 Tauri IPC transport；
- 需要为 macOS arm64/x64 等目标构建独立 runtime；
- Python 依赖打包、代码签名和原生扩展会增加 CI 复杂度；
- 流式事件、取消、超时和子进程崩溃需要在 bridge 协议中定义。

## 未选择的方案

### localhost HTTP/WebSocket

实现简单，但同一台机器上的任何进程都可以尝试访问端口，不符合“只允许桌面应用访问”的要求。

### Unix Domain Socket

可以减少网络暴露，但同一用户下的其他进程仍可能访问 socket；跨平台实现也更复杂，因此暂不作为首版协议。

### 将 Python 代码直接改写为 Tauri/Rust 模块

会产生语言和源码耦合，破坏 agent 独立发布能力，因此不采用。

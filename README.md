# DeepTutor Desktop

DeepTutor Desktop 是 DeepTutor 的 Tauri 桌面分发层，目标是把 DeepTutor agent runtime 随应用一起分发，并通过进程间通信使用它。

当前状态：**完整应用已可构建**。`pnpm build` 产出内嵌 DeepTutor 全栈（Python runtime + Node.js + `deeptutor` wheel）的桌面应用，打开即是完整 DeepTutor Web 界面；同时保留 stdio bridge 协议层用于编程式访问。构建 runtime 需先运行 `scripts/build-runtime.sh`。架构决策见 [ADR-0003](docs/adr/0003-embedded-web-stack.md)。

## 设计目标

- 用户安装一个桌面应用即可使用，不要求预装 Python、Node.js 或 DeepTutor。
- DeepTutor 以独立 Python package/runtime 形式随应用分发。
- agent 不监听 HTTP、WebSocket 或其他 TCP 端口。
- WebView Renderer 不直接接触 agent；所有调用经过 Tauri Command/Event IPC。
- Tauri 层与 agent 源码解耦，可以独立升级。
- 用户数据写入操作系统的应用数据目录，不写入应用安装目录。

## 目标架构

```text
Renderer（WebView：DeepTutor 完整 Web UI）
        ▲ http://127.0.0.1（回环，ADR-0003）
        │
DeepTutor Web（FastAPI 后端 + Next.js 前端）
        ▲ stdin/stdout NDJSON（stdio bridge，ADR-0001）
        │
Embedded Python Runtime + deeptutor wheel + Node.js
        │
Tauri Rust Core（进程生命周期 / 就绪探测 / 窗口导航）
```

## 文档

- [架构说明](docs/architecture.md)
- [ADR-0001：采用 sidecar 与 stdio JSON-RPC](docs/adr/0001-sidecar-stdio.md)
- [ADR-0002：Desktop Shell 采用 Tauri](docs/adr/0002-use-tauri.md)
- [Bridge 协议草案](docs/protocol.md)
- [Runtime 与 Tauri 打包策略](docs/packaging.md)

## 开发

```bash
pnpm install                  # 安装前端依赖
pnpm test:bridge              # 运行 Python bridge 测试
pnpm check                    # JS/Python lint、typecheck 与全部测试
scripts/build-runtime.sh      # 构建内嵌 runtime（首次必做）
pnpm dev                      # 启动 Tauri 桌面应用（开发模式）
pnpm build                    # 打包完整 .app / .dmg
```

开发模式下，Rust 核心会自动查找 `bridge/.venv` 中的 Python 解释器并启动
`python -m deeptutor_desktop_bridge`。可用环境变量覆盖：

- `DEEPTUTOR_BRIDGE`：bridge 可执行文件路径；
- `DEEPTUTOR_BRIDGE_ARGS`：附加启动参数（空格分隔）。

打包模式后续将按 [打包策略](docs/packaging.md) 使用 Tauri `externalBin`
sidecar，替换开发态的解析逻辑。

## 当前目录

```text
bridge/      # deeptutor-desktop-bridge（stdio JSON-RPC sidecar）
frontend/    # 桌面端前端（React + Transport 抽象）
runtime/     # 构建产物约定，不提交实际 runtime
src-tauri/   # Tauri/Rust 主工程（sidecar 生命周期 + IPC 转发）
schemas/     # bridge 协议 v1 JSON Schema
docs/        # 架构、协议与决策记录
```

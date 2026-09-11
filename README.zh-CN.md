# DeepTutor Desktop

把 [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) 完整打包进一个 Tauri 桌面应用的分发层。安装一个 `.dmg` / `.exe` / `.deb`，不预装 Python、Node.js 或 DeepTutor，打开即是完整的 DeepTutor 学习界面。

- **内嵌全栈**：python-build-standalone CPython + 锁定版本的 `deeptutor` PyPI wheel（自带 Next.js 前端产物）+ Node.js 官方二进制，全部作为应用资源随包分发；不复制、不修改上游源码。
- **完整界面**：应用启动后由 Rust 核心拉起 `deeptutor start`（FastAPI 后端 + Next.js 前端），就绪后窗口自动进入 DeepTutor Web UI——聊天、知识库、可视化、设置等全部功能可用。
- **主题与语言跟随**：启动加载页镜像 DeepTutor 的四套主题（snow / light / dark / glass，配色取自其编译产物）；首次启动按系统语言自动预置中文或英文（非中文一律英文），之后尊重应用内的手动切换。
- **stdio bridge 并存**：保留零 TCP 的 stdio JSON-RPC 协议层（`bridge/`），用于编程式访问 DeepTutor 能力，见[协议文档](docs/protocol.md)。
- **干净的生命周期**：退出应用时优雅停止全部后台进程，不遗留任何仍在运行的进程。

## 安装

从 GitHub Releases 下载对应平台的安装包（推送 `v*` 标签后由 CI 自动发布）：

| 平台 | 安装包 |
|---|---|
| macOS Apple Silicon | `DeepTutor-Desktop_<版本>_macos-apple-silicon.dmg` |
| macOS Intel | `DeepTutor-Desktop_<版本>_macos-intel.dmg` |
| Linux x64 | `DeepTutor-Desktop_<版本>_linux-x64.deb` / `.AppImage` |
| Windows x64 | `DeepTutor-Desktop_<版本>_windows-x64_setup.exe` |

首次使用需要在 DeepTutor 的 Settings 中配置模型 API key 才能开始对话。用户数据（配置、知识库、记忆）写入系统应用数据目录，不写入安装目录。

## 架构

```text
┌──────────────────────────────────────────────┐
│ DeepTutor Desktop (Tauri)                    │
│                                              │
│  Renderer（WebView）                          │
│    └ 启动加载页 ──就绪后导航──▶ DeepTutor Web UI │
│                                              │
│  Tauri Rust Core                             │
│    ├ 内嵌栈管理：deeptutor start/stop、        │
│    │ 回环就绪探测、主题/语言预置               │
│    └ stdio bridge 管理（可选，编程式访问）      │
│                                              │
│  Resources/runtime/                          │
│    ├ python/  CPython + deeptutor wheel       │
│    └ node/    Node.js                        │
└──────────────────────────────────────────────┘
              │ http://127.0.0.1（回环）
              ▼
    DeepTutor Web（FastAPI + Next.js）
```

更多细节见[架构说明](docs/architecture.md)与[打包策略](docs/packaging.md)。

## 从源码构建

依赖：[pnpm](https://pnpm.io)、[uv](https://docs.astral.sh/uv/)、Rust 工具链、Node.js 22+。

```bash
pnpm install                    # 前端依赖
scripts/build-runtime.sh        # 构建内嵌 runtime（首次必做，约 800MB）
pnpm build                      # 打包 .app / .dmg（产物在 src-tauri/target/release/bundle/）
```

`scripts/build-runtime.sh` 支持四个目标，需在架构一致的机器上运行：`darwin-arm64`、`darwin-x64`、`linux-x64`、`win32-x64`。CI（`.github/workflows/build.yml`）以四平台矩阵自动构建并发布。

## 开发

```bash
pnpm check                      # JS/Python lint、typecheck 与全部测试
cargo test                      # Rust 单元测试（src-tauri）
pnpm test:bridge                # Python bridge 测试
pnpm dev                        # 开发模式启动桌面应用
```

开发模式下，Rust 核心按 `DEEPTUTOR_RUNTIME_DIR` → 仓库 `runtime/current` 的顺序解析内嵌 runtime；stdio bridge 自动查找 `bridge/.venv` 的 Python。可用环境变量：

- `DEEPTUTOR_RUNTIME_DIR` — 内嵌 runtime 目录（含 `python/` 与 `node/`）
- `DEEPTUTOR_BRIDGE` / `DEEPTUTOR_BRIDGE_ARGS` — 覆盖 bridge 可执行文件与参数

## 目录结构

```text
bridge/        # deeptutor-desktop-bridge（stdio JSON-RPC sidecar）
frontend/      # 渲染层（启动加载页 + Transport 抽象）
runtime/       # 内嵌 runtime 构建产物（gitignore，不提交）
scripts/       # runtime 构建、产物重命名脚本
src-tauri/     # Tauri/Rust 主工程（栈生命周期 + bridge + IPC）
schemas/       # bridge 协议 v1 JSON Schema
docs/          # 架构、协议、打包与 ADR
.github/       # CI 工作流
```

## 安全边界

- 内嵌 Web 栈仅绑定本机回环地址 `127.0.0.1`，网络上其他设备无法访问。
- WebView 渲染层只调用白名单 Tauri commands，无 shell / 子进程权限。
- DeepTutor 作为锁定版本的外部 wheel 依赖消费，本仓库不含其源码；上游升级须通过兼容性测试。

Localized version: [English](README.md).

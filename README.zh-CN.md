[English](README.md) | **简体中文**

<div align="center">

<img src="assets/branding/deeptutor-desktop-icon-1024.png" alt="DeepTutorDesktop 图标" width="160">

# DeepTutorDesktop

把 [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) 完整打包进一个 Tauri 桌面应用的分发层。

安装一个 `.dmg` / `.exe` / `.deb`，不预装 Python、Node.js 或 DeepTutor，打开即是完整的 DeepTutor 学习界面——聊天、知识库、可视化、设置全部可用。

[安装](#安装) · [从源码构建](#从源码构建) · [开发](#开发)

</div>

## 特性

- **内嵌全栈** — python-build-standalone CPython + 锁定版本的 `deeptutor` PyPI wheel（自带 Next.js 前端产物）+ Node.js 官方二进制，全部作为应用资源随包分发；不复制、不修改上游源码。
- **完整界面** — 应用启动后由 Rust 核心拉起 `deeptutor start`（FastAPI 后端 + Next.js 前端），就绪后窗口自动进入 DeepTutor Web UI。
- **主题与语言跟随** — 启动加载页镜像 DeepTutor 的四套主题（snow / light / dark / glass，配色取自其编译产物）；首次启动按系统语言自动预置中文或英文（非中文一律英文），之后尊重应用内的手动切换。
- **stdio bridge 并存** — 保留零 TCP 的 stdio JSON-RPC 协议层（`bridge/`），用于编程式访问 DeepTutor 能力，见[协议文档](docs/protocol.zh-CN.md)。
- **干净的生命周期** — 退出应用时优雅停止全部后台进程，不遗留任何仍在运行的进程。

## 安装

从 [GitHub Releases](https://github.com/pzehrel/DeepTutorDesktop/releases) 下载对应平台的安装包：

| 平台 | 安装包 |
|---|---|
| macOS arm64（Apple Silicon） | `DeepTutorDesktop_<版本>_macos-arm64.dmg` |
| macOS x64（Intel） | `DeepTutorDesktop_<版本>_macos-x64.app.zip` |
| Linux x64 | `DeepTutorDesktop_<版本>_linux-x64.deb` / `.AppImage` |
| Windows x64 | `DeepTutorDesktop_<版本>_windows-x64_setup.exe` |

首次使用需要在 DeepTutor 的 Settings 中配置模型 API key 才能开始对话。用户数据（配置、知识库、记忆）写入系统应用数据目录，不写入安装目录。

### macOS 首次启动

`.app` 采用 ad-hoc 签名而非公证，因此 Gatekeeper 会拦下首次启动并提示"Apple 无法检查其是否包含恶意软件"。右键点按应用 →「打开」，或在「系统设置 → 隐私与安全性 → 仍要打开」中放行一次即可。

在加入 bundle 签名之前构建的版本完全没有有效签名，会提示"DeepTutorDesktop.app 已损坏，无法打开。你应该将它移到废纸篓。"——安装包本身是完整的，坏的只是签名。执行一次以下命令清除隔离标记：

```bash
xattr -rd com.apple.quarantine /Applications/DeepTutorDesktop.app
```

完整说明见 [docs/packaging.zh-CN.md 第 7 节](docs/packaging.zh-CN.md#7-macos-签名与-gatekeeper)。

## 从源码构建

依赖：[pnpm](https://pnpm.io)、[uv](https://docs.astral.sh/uv/)、Rust 工具链、Node.js 22+。

```bash
pnpm install                    # 前端依赖
scripts/build-runtime.sh        # 构建内嵌 runtime（首次必做，约 800MB）
pnpm build                      # 打包 .app / .dmg（产物在 src-tauri/target/release/bundle/）
```

`scripts/build-runtime.sh` 支持四个目标，需在架构一致的机器上运行：`darwin-arm64`、`darwin-x64`、`linux-x64`、`win32-x64`。

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
assets/        # 品牌与图标素材
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

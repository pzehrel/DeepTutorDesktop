# Runtime 与 Tauri 打包策略

## 1. 构建输入

每个目标平台单独构建一个 runtime artifact，由 `scripts/build-runtime.sh <target>` 在**与目标架构一致的机器**上产出：

```text
runtime/<target>/          # 规范目录，保留供检查
runtime/current/           # tauri.conf.json `bundle.resources` 实际打包的路径
├── python/                # 可重定位 CPython (python-build-standalone) + deeptutor wheel 及依赖
└── node/                  # Node.js 官方二进制（deeptutor_web 的 Next.js server 需要）
```

支持的目标：`darwin-arm64`、`darwin-x64`（Intel）、`linux-x64`、`win32-x64`。

DeepTutor 始终以锁定版本的 PyPI wheel（`deeptutor==<version>`）作为外部依赖安装进 runtime；本仓库不复制或修改其源码（见 ADR-0003）。构建产物通过 Tauri `bundle.resources` 映射为应用资源（`Resources/runtime/`），不提交到 Git。

## 2. CI 打包

GitHub Actions（`.github/workflows/build.yml`）以四平台矩阵构建：macos-14（Apple Silicon）、macos-13（Intel）、ubuntu-22.04、windows-latest。产物按平台/架构命名，推送 `v*` 标签时自动创建 Release：

```text
DeepTutor_<version>_macos-apple-silicon.dmg
DeepTutor_<version>_macos-intel.dmg
DeepTutor_<version>_linux-x64.deb / .AppImage
DeepTutor_<version>_windows-x64_setup.exe
```

Intel 与 Apple Silicon 的 macOS 包使用不同文件名，不会混淆。

目标示例：

```text
darwin-arm64
darwin-x64
win32-x64
linux-x64
```

## 3. 构建原则

- 固定 `deeptutor` 版本和依赖 lock；
- 在目标架构上构建，不把本机 venv 直接复制到另一架构；
- 不提交 runtime、wheelhouse 或大体积二进制到 Git；
- 生成 SHA-256，写入 runtime manifest；
- macOS 对所有嵌套可执行文件和动态库执行 codesign；
- 后续再增加 notarization，不在架构阶段实现。

## 4. Tauri sidecar 布局

Bridge/runtime 作为 Tauri `externalBin` 构建输入。每个可执行文件使用目标 triple 后缀，例如：

```text
src-tauri/binaries/
├── deeptutor-bridge-aarch64-apple-darwin
├── deeptutor-bridge-x86_64-apple-darwin
└── ...
```

如果 embedded Python 和 package 不能合并为单一 sidecar，可执行 bridge 仍通过 `externalBin` 分发，其只读依赖资源通过 Tauri resources 一同打包。

应用安装目录只读。运行时配置、日志、记忆、知识库和生成文件必须位于 Tauri 的应用数据目录：

```text
app_data_dir
```

Rust Core 启动 sidecar 并持有其 stdin/stdout；WebView Renderer 不获得通用 shell 权限。

## 5. 首版打包选择

首版优先使用“嵌入式 Python runtime + wheel”。原因：DeepTutor 具有动态导入、可选 provider 和资源文件，先保留 Python package 运行语义，比立即使用 PyInstaller 更容易保持兼容性。

PyInstaller 可以作为后续优化方向，但需要额外维护 hidden imports、package data、原生扩展和多架构构建。

## 6. 更新策略

Desktop 壳和 agent runtime 分开标记版本：

```text
desktop_version: 0.1.0
agent_version: 1.6.6
protocol_version: 1
```

任何 agent runtime 升级都必须通过兼容性测试后再进入桌面发行包。

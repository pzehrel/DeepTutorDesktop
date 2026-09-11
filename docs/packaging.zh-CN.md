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

GitHub Actions（`.github/workflows/build.yml`）以 macos-14（Apple Silicon）、macos-15-intel（Intel）与 windows-latest 矩阵构建；Linux 任务暂时停用（deb/rpm 打包正常，AppImage 受阻）。产物按平台/架构命名。

推送 `v<version>` 标签即为完整发布流程：`version` 任务通过 `scripts/set-version.ts` 将该版本写入所有清单文件并提交到 main（带 `[skip ci]`），构建矩阵基于该提交构建，`release` 任务随后落版两份 changelog、推回 main 并创建 GitHub Release：

```text
DeepTutorDesktop_<version>_macos-apple-silicon.dmg
DeepTutorDesktop_<version>_macos-intel.app.zip
DeepTutorDesktop_<version>_windows-x64_setup.exe
```

Intel 改为发布 zip 压缩的 `.app` 而非 dmg：在 Intel runner 上为这个约 890MB、6.8 万文件的包创建 dmg 镜像要么耗时约 10 分钟，要么死在 `hdiutil detach`（"timeout for DiskArbitration expired"）；而 `ditto -c -k` 只需一两分钟即可产出同样的载荷，且完全不经过 `hdiutil`。

Intel 与 Apple Silicon 的 macOS 包使用不同文件名，不会混淆。本地 `pnpm build` 保持 Tauri 默认产物名（`<productName>_<version>_<arch>.<ext>`，如 `DeepTutorDesktop_0.0.1_aarch64.dmg`）；仅 CI 产物使用上述平台明确命名。

## 3. 构建原则

- 固定 `deeptutor` 版本和依赖 lock；
- 在目标架构上构建，不把本机 venv 直接复制到另一架构；
- 不提交 runtime、wheelhouse 或大体积二进制到 Git；
- 待办：macOS codesign / notarization、Release 附带 SHA-256 校验和（未实现）。

## 4. 应用内资源布局

runtime 不使用 Tauri `externalBin`，而是整体作为资源打包：

```text
DeepTutorDesktop.app/Contents/Resources/runtime/
├── python/    # bin/python3 + site-packages（含 deeptutor 与 deeptutor_web）
└── node/      # Node.js 官方发行版（bin/node）
```

Rust Core 运行时按以下顺序解析 runtime 目录：环境变量 `DEEPTUTOR_RUNTIME_DIR` → 应用 resources（打包态）→ 仓库 `runtime/` 目录（开发态）。启动子进程时把 `node/bin` 前置到 `PATH`，并设置 `DEEPTUTOR_HOME` 指向应用数据目录。

应用安装目录只读。运行时配置、日志、记忆、知识库和生成文件必须位于 Tauri 的应用数据目录（`app_data_dir`）。WebView Renderer 不获得通用 shell 权限。

## 5. 首版打包选择

首版使用"嵌入式 Python runtime + wheel"。原因：DeepTutor 具有动态导入、可选 provider 和资源文件，保留 Python package 运行语义比 PyInstaller 更容易保持兼容性。

PyInstaller 可以作为后续优化方向，但需要额外维护 hidden imports、package data、原生扩展和多架构构建。

## 6. 更新策略

Desktop 壳和 agent runtime 分开标记版本：

```text
desktop_version: 0.1.0
agent_version: 1.6.6
protocol_version: 1
```

任何 agent runtime 升级都必须通过兼容性测试后再进入桌面发行包。

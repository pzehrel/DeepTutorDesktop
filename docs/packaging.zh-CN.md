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
DeepTutorDesktop_<version>_macos-arm64.dmg
DeepTutorDesktop_<version>_macos-x64.app.zip
DeepTutorDesktop_<version>_windows-x64_setup.exe
```

Intel 改为发布 zip 压缩的 `.app` 而非 dmg：在 Intel runner 上为这个约 890MB、6.8 万文件的包创建 dmg 镜像要么耗时约 10 分钟，要么死在 `hdiutil detach`（"timeout for DiskArbitration expired"）；而 `ditto -c -k` 只需一两分钟即可产出同样的载荷，且完全不经过 `hdiutil`。

两个 macOS 包使用不同文件名，不会混淆。构建矩阵里的 `platform` 标签只参与命名 —— artifact、包名与任务名 —— 既不选择 runner（由 `os` 决定），也不选择架构（由该 runner 的宿主机决定），因此它只是命名选择而非构建输入。其取值采用社区通行的 `{os}-{arch}` 命名与 `arm64`/`x64` token：`macos-arm64`、`macos-x64`、保持不变的 `windows-x64`，以及暂缓的 Linux 任务所用的 `linux-x64`。这两个 token 是绝大多数 macOS 与 Windows 项目发布的形态（`AFFiNE-…-macos-arm64.dmg`、`PowerToysSetup-…-x64.exe`），也与 runtime target 标识（`darwin-arm64`、`win32-x64`）及 Tauri 自身的默认 token（`aarch64`、`x64`）对齐。刻意避开 `apple-silicon`/`intel` 这类品牌词：工具链无法把它们映射到架构，每个消费方都得自备一张映射表。本地 `pnpm build` 保持 Tauri 默认产物名（`<productName>_<version>_<arch>.<ext>`，如 `DeepTutorDesktop_0.0.1_aarch64.dmg`）；仅 CI 产物使用上述平台明确命名。

## 3. 构建原则

- 固定 `deeptutor` 版本和依赖 lock；
- 在目标架构上构建，不把本机 venv 直接复制到另一架构；
- 不提交 runtime、wheelhouse 或大体积二进制到 Git；
- macOS 包做 ad-hoc 签名，使 Gatekeeper 的签名校验能够通过（见第 7 节）；
- 仍未实现：Developer ID 签名 / 公证（notarization）、Release 附带 SHA-256 校验和。

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

## 7. macOS 签名与 Gatekeeper

`src-tauri/tauri.conf.json` 中设置了 `bundle.macOS.signingIdentity: "-"`，Tauri 在打包时会对 `.app` 做 ad-hoc 签名。它不涉及 Apple 开发者账号，签名里也没有团队身份，但它会生成**封印（seal）**，而封印正是 Gatekeeper 首次启动时唯一检查的东西。

不签名时，`.app` 只带有 Rust 链接器写进 Mach-O 可执行文件里的那个 ad-hoc 签名。链接器签名声明了资源清单，但打包过程从不为 bundle 写入 `Contents/_CodeSignature/CodeResources`，因此校验必然失败：

```console
$ codesign --verify --deep --strict DeepTutorDesktop.app
DeepTutorDesktop.app: code has no resources but signature indicates they must be present

$ spctl -a -vvv -t exec DeepTutorDesktop.app
DeepTutorDesktop.app: code has no resources but signature indicates they must be present
```

macOS 只对带隔离标记的 bundle 做这项检查，而从浏览器下载的 dmg 会给解出的每个文件都打上 `com.apple.quarantine`。校验失败时用户看到的就是那句误导性的 **"DeepTutorDesktop.app 已损坏，无法打开。你应该将它移到废纸篓。"** —— 载荷其实是完整的，坏的只是签名；这也解释了为什么同一个 `.app` 直接从挂载的 dmg 卷里启动却完全正常（卷上的文件没有隔离标记）。

ad-hoc 签名修掉了这个失败，但不会消除警告：`codesign --verify --deep --strict` 此时返回 0，Gatekeeper 退化为普通的"Apple 无法检查其是否包含恶意软件"，用户可以右键 →「打开」或在「系统设置 → 隐私与安全性 → 仍要打开」中放行。那个无从绕过的"已损坏"弹窗不再出现。Tauri 默认开启的 hardened runtime 保持启用：ad-hoc 签名配合 `--options runtime` 仍能解析并加载内嵌 CPython 的扩展模块，已通过启动签名后的 bundle 并观察到 uvicorn 正常拉起验证。

在此签名加入之前发布的产物，可以通过去掉隔离标记来救回 —— 对完整的 bundle 来说这就是唯一的障碍：

```bash
xattr -rd com.apple.quarantine /Applications/DeepTutorDesktop.app
```

这是本地绕过手段，不是分发方案：它只压制首次启动检查，执行的仍是未受信任的签名。

要彻底消除警告则需要 **Developer ID 签名 + 公证（notarization）**，而这并不是一行配置的事。它需要付费的 Apple 开发者账号以及 CI secrets（`APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`，外加 `APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID` 或 `APPLE_API_KEY` + `APPLE_API_ISSUER`），并且公证会校验 bundle 内的每一个嵌套 Mach-O。本包在 `Contents/Resources/runtime/` 下内嵌了上游的 CPython 与 Node.js 发行版（约 6.8 万个文件），因此其中的可执行文件、`.dylib` 与 `.so` 都必须先用 Developer ID 逐个签名，之后才能封外层 bundle。Apple 已废弃 `--deep`，不能用它来替代这一轮逐个签名。

字节码缓存是唯一绝不能落进 bundle 的运行时写入。若保持默认，内嵌 CPython 会在首次启动时把字节码**编译进**应用，在 `Contents/Resources/runtime/python/lib/python3.13/` 下写入 `__pycache__/*.pyc`，从而破坏资源封印：

```console
$ codesign --verify DeepTutorDesktop.app
DeepTutorDesktop.app: a sealed resource is missing or invalid
file added: .../runtime/python/lib/python3.13/encodings/__pycache__/idna.cpython-313.pyc.4442832944
```

ad-hoc 签名的包扛得住一次这样的破坏：Gatekeeper 在应用运行前评估，首次成功启动后 LaunchServices 会清掉隔离标记，之后的启动不再复查。公证过的包没有这种余地 —— macOS 会重新评估已公证的应用，封印资源发生变化就拒绝。

因此桌面壳在每次拉起 CLI 时都设置 `PYTHONPYCACHEPREFIX` 指向 `<app-data>/deeptutor/pycache`（见 `src-tauri/src/stack.rs` 的 `run_cli`），launcher 拉起的 uvicorn 与 Node 子进程会继承该变量。解释器仍能跨启动复用字节码缓存，bundle 与 Tauri 签名时的字节完全一致，任意次运行后 `codesign --verify` 依然通过。重定向会使 `runtime/current` 里随包发行的 `.pyc` 失效（Python 只从 prefix 读缓存），因此引入该重定向后的首次启动需要向新位置重新编译一遍 —— 实测后端就绪约 12 秒，热启动约 3 秒，属于每安装一次的代价。第 4 节"应用安装目录只读"现在真正成立了。

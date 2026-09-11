# 更新日志

本项目所有值得关注的变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

- 暂无值得关注的变更。

## [0.0.1] - 2026-09-11

### 新增
- **release:** 自动生成双语更新日志并采用规范提交 (`befc703`)
- **shell:** 将内嵌栈固定到高位回环端口 (`b24f816`)
- DeepTutor Desktop 桌面外壳（Tauri 2），集成 Python stdio JSON-RPC 桥接，
  并在 `schemas/bridge/v1/` 下维护版本化协议 schema。
- 将完整的 DeepTutor Web 技术栈嵌入桌面外壳，并为内嵌 CLI 调用设置
  `DEEPTUTOR_HOME` 环境变量。
- 启动加载页沿用 DeepTutor 的界面主题。
- 多平台打包与 GitHub Actions 构建，每个平台一个以产品名命名的安装包。
- 应用图标集与 v3 品牌标识。
- 首次启动时跟随操作系统语言选择界面语言。
- 面向用户的 README，以及架构、打包、协议文档（英文主文件 + zh-CN 对应文件）。

### 变更

- 产品更名为 DeepTutor Desktop。

- **packaging:** 升级内嵌 DeepTutor 至 1.6.7 (`f262680`)
- **shell:** 应用图标与加载页改用官方 DeepTutor 标识 (`48e5183`)
### 修复
- **release:** 重推旧 tag (或从过期分支发布) 会静默把 main 上记录的版本号降级 —— v0.0.1 曾覆盖依赖巡检任务设置的 0.0.2。version 任务现在先执行 scripts/set-version.ts --guard <tag 版本>, 将 tag 与 package.json 比较, 当 tag 更旧时以非零退出, 并提示向前推进版本号或重新指向 tag。未知标志改为打印用法而非抛异常。 (`99855e1`)
- **release:** 跨行的 zh-CN 主题只会发布首行, 造成中文条目被截断; 现在会拼接续行 (中文直接拼接, 拉丁文以空格连接), 直到空行、另一个 trailer 或新的规范提交主题为止。 (`2732d79`)
- **release:** 将 [Unreleased] 正文过滤为非空行会在落版本后把手写分组粘在一起; 现在只去掉首尾空行与占位行, 小节结构得以保留。 (`14b90b8`)
- **release:** 落版本时整段 [Unreleased] 被自动条目替换, 导致自动化之前人工整理的内容丢失; 现在自动条目会追加在手写内容之后并去重 (比较时忽略结尾的哈希,因为手写行可能带旧哈希), 标题也不重复。进度信息改走 stderr —— workflow 把stdout 重定向为 Release 正文, 曾把 "updated CHANGELOG.md" 泄漏进 v0.0.1的发布页面。 (`145247b`)
- **release:** 两个缺陷导致 v0.0.1 无法发布: (`98d83ef`)
- **ci:** --bundles 只接受各平台自身的目标值 (Windows 为 msi/nsis, macOS 为 app/dmg), 'all' 被所有 job 拒绝。Linux 暂停后无需限制,直接 'pnpm exec tauri build' 由 tauri.conf.json 的 targets 生效,并注释记录 Linux job 恢复时的 '--bundles deb,rpm' 用法。 (`8765d3d`)
- **ci:** pnpm 的脚本转发会把 -- 分隔符传递给内层命令, 导致'pnpm build -- --bundles ...' 中的标志被 tauri 转交 cargo 而被拒绝('unexpected argument --bundles'), 四个平台全部失败。改为直接调用'pnpm exec tauri build --bundles ...'。 (`84dd9d2`)
- **ci:** macOS 13 runner 镜像已于 2025-12-04 退役, macos-intel 任务因此永远停在队列里等不到 runner。macos-15-intel 是 GitHub 为标准 x86_64 runner 提供的替代标签, 继续保证内嵌 Python runtime 跑在 Intel 机器上。 (`b051aeb`)
- **ci:** 折叠 (>) 运行块会把所有行拼接为单条 shell 命令, 为 libfuse2添加的行内 # 注释使其后的所有参数都被注释掉, 该包从未被安装, linuxdeploy 依旧因缺少 FUSE 失败。将注释移到步骤上方, 确保libfuse2 真正传给 apt-get。 (`1011da6`)
- **ci:** 修复 Windows 发布步骤将 POSIX 风格路径 (/d/a/...) 传给PowerShell 的 Copy-Item 而被解析为 D:\d\a\... 导致的PathNotFound 失败。Git Bash 自带的 cp -RL 原生支持这些路径,因此完全移除 PowerShell 分支。 (`2ff2453`)
- **ci:** Windows 的 python-build-standalone 将 uv 的 externally-managed标记存放在 Lib/EXTERNALLY-MANAGED 而非 lib/python3.x/, 导致 uv pip install 拒绝向拷贝的解释器安装包。同时移除两处标记。 (`ad35fa6`)
- **ci:** 修复 windows-x64 runtime 构建在 uv python install 后立即崩溃的问题: 脚本原先假设 Unix 安装根目录 ($HOME/.local/share/uv/python),而 Windows 使用 %APPDATA%\uv\python, 且 ls 无匹配时在 pipefail 下以码 2 中止脚本。改为向 uv 查询安装根目录, 容忍无匹配场景, 并兼容Windows python-build-standalone 包的嵌套 python/ 目录布局与位于安装根目录的 python.exe 解释器路径。 (`873aae7`)
- **ci:** 显式传入目标参数时跳过 build-runtime.sh 的宿主探测并兼容MSYS2 uname 返回的 x86_64 架构名, 修复 windows-x64 任务的"unsupported host" 中止; 为 Linux 依赖新增 libfuse2, 使 Tauri 打包AppImage 时 linuxdeploy 工具可正常执行。 (`b3a4c67`)

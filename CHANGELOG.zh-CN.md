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

### 修复
- **release:** 跨行的 zh-CN 主题只会发布首行, 造成中文条目被截断; 现在会拼接续行 (中文直接拼接, 拉丁文以空格连接), 直到空行、另一个 trailer 或新的规范提交主题为止。 (`2732d79`)
- **release:** 将 [Unreleased] 正文过滤为非空行会在落版本后把手写分组粘在一起; 现在只去掉首尾空行与占位行, 小节结构得以保留。 (`14b90b8`)
- **release:** 落版本时整段 [Unreleased] 被自动条目替换, 导致自动化之前人工整理的内容丢失; 现在自动条目会追加在手写内容之后并去重 (比较时忽略结尾的哈希,因为手写行可能带旧哈希), 标题也不重复。进度信息改走 stderr —— workflow 把stdout 重定向为 Release 正文, 曾把 "updated CHANGELOG.md" 泄漏进 v0.0.1的发布页面。 (`145247b`)
- **release:** 两个缺陷导致 v0.0.1 无法发布: 发布 tag 被当作自己的上一版本 (提交区间为空), 且手写的 `[Unreleased]` 小节拒绝落版本 (`98d83ef`)

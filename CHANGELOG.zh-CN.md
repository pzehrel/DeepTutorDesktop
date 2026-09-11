# 更新日志

本项目所有值得关注的变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

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

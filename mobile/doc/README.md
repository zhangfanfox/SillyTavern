SillyTavern Mobile（React Native + Expo）

本目录包含将本项目封装为移动端 App 的详细说明、需求、架构设计与实施计划。目标是在尽量复用现有 `src/` 中与平台无关的逻辑代码的前提下，用 React Native + Expo 实现移动端 UI 与设备相关功能。

阅读顺序建议：

1) requirements.md — 详细需求与范围（MVP 与扩展）
2) architecture.md — 技术选型、目录结构、状态/网络/存储等架构方案
3) ui-spec.md — 页面与组件规范（对应附件中的 5 张效果图）
4) reuse-map.md — 代码复用与适配清单（需做的 polyfill/shim）
5) implementation-plan.md — 里程碑与落地步骤（包含验收标准）
6) setup.md — 搭建与本地运行说明（macOS/zsh/Expo）
7) testing-and-ci.md — 测试策略与基本 CI 说明
8) risks.md — 风险与规避策略

如无特殊说明，所有移动端代码与资源放在 `mobile/` 目录，平台相关实现（UI、权限、存储等）仅放在 `mobile/`，跨端可复用逻辑优先直接引用 `src/` 或抽取到 `mobile/shared`。

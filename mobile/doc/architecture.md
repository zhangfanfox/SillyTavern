# 架构与技术方案

## 技术选型评估：RN + Expo
- 选择 RN + Expo 的理由：
  - 跨平台（iOS/Android）同构 UI；OTA 更新（EAS Update）便于快速灰度。
  - Expo 提供摄像头、相册、文件、加密存储、网络等能力，减少原生胶水。
  - 与现有 JS/TS 代码复用度高。
- 考量：
  - Node.js 内置模块（fs/path/crypto/buffer/stream 等）在 RN 环境不可直接使用，需要 polyfill 或替代实现。
  - 某些库（yauzl、simple-git、jimp 等）不适用于 RN；相关功能仅在“角色卡 PNG 读写”“ZIP 解包”等特定场景出现，移动端需要替代方案。

结论：采用 RN + Expo 可行，需为少量 Node-only 逻辑提供 shim；优先直接复用与“提示词转换、常量映射”相关的纯函数模块。

## 目录结构（提议）
```
mobile/
  app/                   # Expo Router 应用根
    _layout.tsx         # 顶层导航布局（包含左右抽屉）
    index.tsx           # 默认路由：会话或角色
    chat/[chatId].tsx   # 聊天页（图1）
    roles/
      index.tsx         # 角色列表
      create.tsx        # 角色创建（图2）
      import.tsx        # 文件/URL 导入
    settings/
      api/index.tsx     # API 连接列表（图4）
      api/edit.tsx      # 新建/编辑连接
    sheets/
      right-panel.tsx   # 右侧参数面板（图5）
  components/           # 通用组件（MessageList、ChatInput、FormField 等）
  hooks/                # 自定义 hooks（useChat, useApi, useStorage, useTheme）
  services/
    llm/                # LLM 供应商统一封装（OpenAI/Claude/Gemini/OpenRouter/Custom）
    storage/            # AsyncStorage/SecureStore 封装
    files/              # 角色卡导入/导出、图片处理
  shared/               # 与 src/ 复用的代码副本或包装
    prompt-converters.ts  # 从 src/prompt-converters.js 适配（ES 模块）
    constants.ts          # 从 src/constants.js 适配（去除 Node 专属常量）
    character-card.ts     # 角色卡元数据读写（RN 兼容版）
  polyfills/            # Node API 兼容（Buffer、crypto-lite、events 等）
  types/                # TS 类型声明
  doc/                  # 本文档
  package.json          # 独立包管理（建议）
  README.md             # 移动端项目自述
```

说明：
- 采用 Expo Router（文件式路由），抽屉（Drawer）+ Stack 模式：
  - 左抽屉：会话与角色、API 链接入口
  - 右抽屉：参数设置（可用 Drawer 或自定义侧滑面板）
- 共享逻辑优先“软链接/复制 + 轻适配”，避免直接改动 `src/`。若后续希望上游共享，可以抽出独立 `packages/`。

## 状态管理
- 轻量采用 Zustand 或 Jotai：
  - appStore：主题、国际化、网络状态
  - chatStore：当前会话、消息、流式状态、停止标记
  - roleStore：角色列表、导入/创建状态
  - apiStore：供应商/模型/密钥与默认连接
- 持久化：zustand-persist + AsyncStorage；敏感信息使用 SecureStore。

## 网络层
- fetch + 供应商适配器：
  - OpenAI: /v1/chat/completions（或 Responses API）
  - Anthropic(Claude): Messages API
  - Google(Gemini): Generative Language API
  - OpenRouter、Groq、Mistral… 按需扩展
- 流式：
  - 首选官方流式（SSE、text/event-stream 或 chunked JSON）
  - 基于 ReadableStream 解析器，派发到 chatStore。

## 数据模型（简要）
- Character
  - id, name, avatarUri, description, systemPrompt, meta
- Chat
  - id, characterId, createdAt, messages: Message[]
- Message
  - id, role: 'user'|'assistant'|'tool', parts: Text/Image/Tool[], createdAt, error?
- ApiConnection
  - id, provider, baseUrl, apiKey, defaultModel, params

## 安全与隐私
- apiKey 使用 Expo SecureStore；导出/备份时需显式确认。
- 默认仅允许 HTTPS；允许自定义证书与代理（后续）。

## 复用策略
- 直接复用：`prompt-converters.js`（需移除对 node:crypto 的哈希调用或用 `expo-crypto` 替代）。
- 选择性复用：`constants.js`（提取纯常量，不包含路径/FS 相关）。
- 需重写：`character-card-parser.js`（fs/Buffer → 使用 `react-native-fs`、`png-chunks-extract` 的 RN 兼容方案或纯 JS PNG 解析器；如难度大，MVP 先支持 JSON 导入，PNG 读写延后）。

## 国际化
- 使用 `i18n-js` 或 `react-intl`；中文为默认，结构预留。

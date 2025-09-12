# UI 规格（基于 5 张参考图）

> 说明：使用 React Native Paper 或 Tamagui/NativeWind 之一实现基础组件；Expo Router 管理路由；左/右侧边栏采用 Drawer 或自定义滑出面板。

## 通用
- 顶部栏：
  - 左侧按钮：打开左侧抽屉（会话/角色）
  - 右侧按钮：打开右侧抽屉（参数）
- 主题：浅/深色，遵循系统；主要色为紫调（可在主题中配置）。
- 手势：
  - 左滑打开右抽屉、右滑打开左抽屉（可在设置中关闭）。

## 页面与组件

### 1. 聊天页 Chat (图1)
- Header：角色头像 + 名称；左/右图标按钮。
- MessageList：
  - 气泡左右对齐；支持代码块高亮（`react-native-syntax-highlighter`）。
  - 图片消息显示缩略，点开全屏预览。
  - 流式输出时尾部显示光标动画；“停止生成”按钮浮动在底部。
- ChatInput：
  - 多行文本框 + 发送按钮。
  - 附件按钮（图片）— MVP 先禁用功能，仅展示入口。
- Scroll：
  - 首次加载最新 30 条；上滑触底继续加载历史。

### 2. 左侧抽屉 Sidebar (图3)
- 区域：
  - 最近会话列表（按时间排序）；每项：头像、名称、最后一条摘要。
  - 顶部“+”按钮：
    - 跳转“创建角色”（图2）。
  - 底部模块：
    - API 连接入口（图4）。

### 3. 角色创建/导入 (图2)
- Tab：新建 | 从文件导入 | 从 URL 导入（URL 先占位）。
- 新建表单：
  - 头像选择（相册/拍照）；名称（必填）；简介；系统提示/预设。
- 从文件导入：
  - 选择 JSON 或 PNG；成功后进入“编辑确认”页，可再修改名称/头像。

### 4. API 连接 (图4)
- 列表：项内展示 provider、默认模型、是否默认。
- 操作：设为默认、编辑、删除、新建。
- 编辑页：
  - provider（openai/claude/gemini/openrouter/custom…）
  - baseUrl、apiKey（密钥输入，SecureStore）、默认模型
  - 公共参数集：maxTokens、temperature、top_p、top_k、penalties、seed、min_p、stream…

### 5. 右侧抽屉（参数面板）(图5)
- 根据 provider 动态渲染可用参数：
  - OpenAI：model、max_tokens、temperature、top_p、presence_penalty、frequency_penalty…
  - Claude：model、max_tokens、reasoning_effort、cache 控制等（逐步实现）
  - Gemini：model、maxOutputTokens、safety 开关（基于 `constants.GEMINI_SAFETY`）
- 保存范围：仅对当前会话生效，或“保存为默认”。

## 交互与状态
- 错误：Toast 显示；需要时在消息流插入错误节点。
- 空态：无角色/无连接时给出引导。

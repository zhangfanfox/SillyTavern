# 实施步骤与里程碑

> 目标：4 个迭代完成 MVP 可用版本（iOS/Android Dev 客户端），第 5 个迭代补强导入/PNG 等。

## 里程碑 M0：工作区初始化（1d）
- [x] 创建 `mobile/` 下 Expo 项目（独立 package.json）
- [x] 引入依赖（已写入 package.json）：expo-router、react-native-paper、zustand、@react-native-async-storage/async-storage、expo-secure-store、buffer、expo-crypto、react-native-gesture-handler 等
- [x] 配置 polyfill（Buffer/random-values，见 `mobile/src/polyfills/`），EAS 项目初始化（可选，待安装依赖后进行）
- [x] 设置 TypeScript 与 ESLint（`tsconfig.json`、`.eslintrc.js`、`babel.config.js`）

## 里程碑 M1：导航与框架（2-3d）
- [x] 顶层布局 `_layout.tsx`，实现左右抽屉与 Header 按钮
- [x] 路由：主页、聊天页、角色列表、角色创建、API 连接列表/编辑、右侧参数面板（占位）
- [x] 主题与暗黑模式（系统/浅色/深色，可持久化）
- [x] 状态管理骨架（stores）与持久化（Zustand + AsyncStorage）

## 里程碑 M2：基础数据模型与 API 连接（3-4d）
- [ ] ApiConnection CRUD + SecureStore
- [ ] 参数面板根据 provider 动态渲染（读取 `constants`）
- [ ] LLM 适配层最小实现（OpenAI + Gemini 或 Claude 二选一先上）
- [ ] 流式输出解析与中止

## 里程碑 M3：聊天页与会话管理（4-6d）
- [ ] MessageList/ChatInput 组件与滚动加载
- [ ] 发送/接收消息（含流式）
- [ ] 错误处理与重试、停止生成
- [ ] 会话的本地持久化（最近 3-5 个会话在左侧抽屉）

## 里程碑 M4：角色创建/导入（3-5d）
- [ ] 新建角色（头像/名称/系统提示）
- [ ] JSON 导入（MVP）
- [ ] 角色关联会话与默认系统提示注入

## 里程碑 M5：增强与收尾（3-5d）
- [ ] PNG 角色卡读写（若库可行）或提供“PNG→JSON 转换”外链
- [ ] 多供应商切换与参数集合预设
- [ ] 多模态入口（图片发送，先限静态图）
- [ ] 打包与基本发布流程（TestFlight/内测 APK）

## 验收标准（MVP）
- iOS/Android 真机均可运行；
- 能创建一个 API 连接并设为默认；
- 能新建一个角色，进入聊天；
- 能发送文本消息并获得流式回复；
- 左/右抽屉工作正常；
- 应用重启后，角色/会话/API 连接仍在；密钥未明文暴露。

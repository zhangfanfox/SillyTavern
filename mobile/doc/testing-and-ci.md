# 测试策略与 CI 基线

## 单元测试
- 纯函数（prompt 转换、常量映射、参数计算）使用 Jest 运行。
- `mobile/shared` 与 `services/llm` 的构造函数进行最小桩测试。

## 组件测试
- React Native Testing Library：对 ChatInput、MessageList 做交互测试（发送、加载更多）。

## 手动验收清单
- 新建 API 连接 → 设为默认 → 聊天页发送并收到回复（流式）。
- 左右抽屉开合、参数修改即时生效。
- 角色新建/JSON 导入后可进入聊天。

## CI（可选）
- GitHub Actions：
  - 安装依赖、TypeScript 检查、Jest 测试。
  - `expo prebuild`/EAS 构建可在后续阶段加入。

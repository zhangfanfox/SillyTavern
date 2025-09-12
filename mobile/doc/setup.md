# 本地搭建与运行（macOS, zsh）

## 前置
- Node 18+
- `npm i -g expo-cli`（可选，使用 `npx expo` 亦可）
- iOS: Xcode + 模拟器；Android: Android Studio + 模拟器；或真机 Expo Go

## 初始化（建议后续由我自动脚手架）
1. 在仓库根目录创建 Expo 应用（稍后可由脚本创建）：
   - 路径：`mobile/` 作为独立项目
2. 安装依赖（示例）：
   - expo, react-native, react, expo-router, react-native-paper 或 tamagui
   - @react-native-async-storage/async-storage, expo-secure-store
   - buffer, expo-crypto, react-native-get-random-values
   - zustand, immer
   - react-native-gesture-handler, react-native-reanimated
   - 语法高亮/图片等库按需
3. 在入口（app/_layout.tsx 或 app/index.tsx）注入 polyfill：
   ```ts
   import { Buffer } from 'buffer';
   if (!global.Buffer) global.Buffer = Buffer as any;
   ```
4. 运行
   ```
   npx expo start
   ```
5. 连接模拟器或 Expo Go 扫码运行。

## 注意
- 流式解析需要启用 `fetch` 的 ReadableStream 支持；Expo 现已支持。
- 真机网络可能受代理/证书影响；自定义 baseUrl 时请确保 HTTPS 可达。

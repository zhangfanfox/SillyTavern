# SillyTavern Mobile (Expo)

最小可运行骨架：Expo Router + React Native Paper + polyfills。当前为 Expo SDK 54。后续按 `mobile/doc` 的计划迭代。

启动（需先在本目录安装依赖）：
- `npm install`
- `npm run start`

如遇版本不匹配，优先运行 `npx expo install --fix` 对齐 Expo SDK 54。当前关键依赖版本：

- expo ~54.0.0
- expo-router ~6.0.1
- expo-crypto ~15.0.7
- expo-secure-store ~15.0.7
- react 19.1.0 / react-native 0.81.4
- @react-native-async-storage/async-storage 2.2.0
- react-native-gesture-handler ~2.28.0 / reanimated ~4.1.0 / screens ~4.16.0 / safe-area-context ~5.6.0

注意：在 VS Code 内置终端使用登录 shell（zsh -l/PowerShell 默认），保证环境变量正确注入；仓库已在 `.vscode/settings.json` 配置。

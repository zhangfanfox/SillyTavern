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

## 角色导入（Mobile）

- 支持 SillyTavern JSON（v2/v3/简易），以及部分平台 URL。对 JanitorAI 链接优先走 Janny API 下载 PNG 卡片（含 tEXt 元数据），失败再回退至 HTML 抓取。
- 关键日志会输出到 RN Console（前缀如 `[role-importers]`、`[roles.store]`、`[ImportScreen]`）。
- 成功/失败会在导入页面进行 UI 反馈（Snackbar + 错误提示）。

快速自检（离线 mock）：

1. 在 `mobile/` 目录安装依赖：`npm i`
2. 运行导入测试（使用 tsx 脚本，模拟网络）：

	```sh
	npm run test:importer
	```

预期输出：

```
[role-importers] parseRoleFromURL start ...
[role-importers] JanitorAI detected, uuid: ...
[role-importers] POST https://api.jannyai.com/api/v1/download
[role-importers] Downloading card https://files.example.com/fake-card.png
[role-importers] Downloaded bytes ...
[role-importers] Parsed role name: Shinichi Kudo ...
OK
```

如果要在真机模拟导入（实际访问站点），请注意 JanitorAI 站点 Cloudflare 防护和地区网络环境可能导致失败，建议优先使用 Desktop 版 SillyTavern 或设置代理。

## 本地原生打包（Eject/Prebuild）

先决条件：
- Android：安装 Android Studio（含 SDK、NDK 可选），设置 `ANDROID_HOME`，并在 SDK Manager 安装对应 API/构建工具；将 `platform-tools` 和 `platforms;android-<API>` 的 `tools` 加入 `PATH`。
- iOS：需在 macOS 上安装 Xcode（Windows 无法生成/编译 iOS）。

已配置项：
- `app.json` 中已设置 `ios.bundleIdentifier` 与 `android.package` 为 `com.foxai.sillytavern`。

生成原生工程：

```powershell
# 在 Windows/PowerShell 下，先进入 mobile 目录
cd mobile
npx expo prebuild

# 如需仅生成 Android（Windows 环境建议）
npx expo prebuild --platform android

# 仅生成 iOS（请在 macOS 运行）
npx expo prebuild --platform ios
```

预期在 `mobile/` 下出现 `android/`（Windows 可生成）与 `ios/`（macOS 才能生成）目录。

Android 调试运行：

```powershell
cd mobile
npx expo run:android
```

Android Release 构建（APK/AAB）：

```powershell
cd mobile/android
./gradlew.bat assembleRelease   # 生成 APK：app/build/outputs/apk/release/
./gradlew.bat bundleRelease     # 生成 AAB：app/build/outputs/bundle/release/
```

### 仅构建 arm64-v8a 与 x86 架构（单 APK）

本仓库将 Android ABI 限制为 `arm64-v8a` 与 `x86`，并通过 NDK `abiFilters` 生成单个 APK（不再使用 `splits { abi }` 拆分多 APK）。

- 插件会移除旧的 `splits { abi { ... } }` 代码片段，并在 `defaultConfig {}` 注入：

	```gradle
	// @sillytavern-ndk-abi-filters-start
	ndk {
			abiFilters 'arm64-v8a', 'x86'
	}
	// @sillytavern-ndk-abi-filters-end
	```

- 构建产物：
	- Dev 调试 APK：`android/app/build/outputs/apk/devclient/debug/app-devclient-debug.apk`
	- Prod 发布 APK：位于 `android/app/build/outputs/apk/prod/release/`

说明与建议：
- `x86` 适配 32 位模拟器；`arm64-v8a` 覆盖多数真机。
- 如需增/减 ABI，请在 `app.json` 的插件参数 `abis` 中调整，例如：

	```jsonc
	["./plugins/with-android-abi-splits", { "abis": ["arm64-v8a", "x86"] }]
	```

	然后在 `mobile/` 下执行 `npx expo prebuild --platform android` 以同步到 Gradle。

iOS 构建（需 macOS）：

```sh
cd mobile
npx expo run:ios                 # 首次会生成 ios/ 并用 Xcode 构建

# 或者用 Xcode 打开 ios/*.xcworkspace 进行 Archive/签名
```

常见问题：
- 如果依赖/版本不匹配，运行 `npx expo install --fix`。
- Android 如果报 SDK/Gradle 版本问题，使用 Android Studio 的 “Project Structure”/“Gradle Settings” 自动同步；必要时删除 `android/.gradle` 与 `android/build` 后重试。
- iOS 生成失败请确认在 macOS 上执行，并安装 Command Line Tools：`xcode-select --install`。

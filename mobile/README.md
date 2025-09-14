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

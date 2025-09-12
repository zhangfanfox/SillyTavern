# 代码复用与适配清单

目标：最大限度复用 `src/` 的平台无关逻辑。

## 可直接复用（轻微改造或通过包装）
- `src/prompt-converters.js`
  - 依赖项：`node:crypto`、`Buffer` 等。
  - 处理：
    - `crypto`：使用 `expo-crypto`（提供 `Crypto.digestStringAsync`）；或用 `js-sha512`/`uuid` 替代散列与随机。
    - `Buffer`：使用 `buffer` polyfill（`npm i buffer`，并在入口注入 `global.Buffer`）。
  - 输出：导出函数保持原型，以便 llm 适配层直接调用。

- `src/constants.js`
  - 保留纯常量（模型 key、headers、枚举等）。
  - 移除/隔离与 FS/路径相关（如 PUBLIC_DIRECTORIES、默认头像路径等）。

## 需要重写或提供 RN 版本
- `src/character-card-parser.js`
  - 问题：使用 `fs`、`Buffer`、`png-chunks-extract`、`png-chunk-text` 等 Node/DOM API。
  - 方案：
    1) MVP：仅支持 JSON 导入/导出；PNG 读写延后。
    2) 进阶：采用纯 JS PNG 解析库（如 `pngjs` RN 兼容分支或社区方案），文件访问用 `expo-file-system`；文本 chunk 读写按 tEXt/ccv3 规范实现。

- `src/util.js`
  - 含大量 Node 专属（fs/path/http2/os/simple-git 等），移动端不可复用。仅挑选个别纯函数（如 `tryParse`, `removeFileExtension`）复制到 `mobile/shared/utils.ts`。

## Polyfill/替代
- Buffer: `buffer`
- Crypto: `expo-crypto` 或 `react-native-get-random-values` + 轻量哈希库
- Streams: 尽量使用 WHATWG ReadableStream（Expo fetch 支持）
- FileSystem: `expo-file-system`

## LLM 适配
- 在 `mobile/services/llm/` 定义统一接口：
  - send(messages, options): Observable/AsyncIterator 流式返回
  - 支持 openai、anthropic、google、openrouter…
- 使用 `reuse-map` 中的转换器输出不同平台的请求体。

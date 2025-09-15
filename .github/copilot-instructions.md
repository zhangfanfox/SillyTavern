# SillyTavern – AI Assistant Working Rules

These notes make AI coding agents productive quickly in this repo. Keep advice specific to this codebase and its patterns.

## Architecture Overview
- Server: Node.js 18+ ESM Express app. Entry: `server.js` → `src/server-main.js` → `src/server-startup.js`.
- Frontend: Served from `public/` with live bundling via `src/middleware/webpack-serve.js`.
- Data/config: `config.yaml` at repo root (or global with `--global`). User data under `data/` with per-user directories (`default-user/…`). `globalThis.DATA_ROOT` set by CLI (`src/command-line.js`).
- Auth/session: Cookie-session + optional Basic Auth + optional whitelist. CSRF enabled by default for private routes; fetch `/csrf-token` and send header `x-csrf-token`.
- Routers: Public under `/api/users` before auth; private endpoints are wired in `setupPrivateEndpoints()` in `src/server-startup.js`. Static root `GET /` serves `public/index.html` and redirects to `/login` if needed.
- Plugins: Server plugins (Express routers) loaded from `./plugins` via `src/plugin-loader.js` when `enableServerPlugins: true`. Each plugin exposes `info`, `init(router)`, optional `exit()`; mounted at `/api/plugins/<id>`.

## Run, Debug, Test
- Start server: `npm start` (runs `node server.js`). Debug: `npm run debug` (Node inspector). Electron UI: `npm run start:electron`.
- Key CLI/config flags (see `src/command-line.js`): `port`, `listen`, `protocol.ipv4/ipv6`, `ssl.enabled`, `whitelistMode`, `basicAuthMode`, `enableCorsProxy`, `disableCsrfProtection`, `requestProxy.*`, `browserLaunch.*`.
- Tests (headless UI via Jest+Puppeteer in `tests/`): start SillyTavern on `http://localhost:8000` first, then run Jest in `tests/`. Sample waits for `#preloader` removal.

## Backend Patterns (LLM providers)
- Chat completions router: `src/endpoints/backends/chat-completions.js` mounts under `/api/backends/chat-completions`.
  - `POST /status`: Lists models for a `CHAT_COMPLETION_SOURCES` provider using provider-specific auth and headers.
  - `POST /generate`: Unified adapter that builds body, converts prompts, and proxies to provider endpoint. Streaming uses `forwardFetchResponse()` to pipe SSE.
  - Prompt conversions live in `src/prompt-converters.js` (e.g., `convertClaudeMessages`, `convertGooglePrompt`, `postProcessPrompt`, `addAssistantPrefix`). Use `getPromptNames(request)` to label prompt sections consistently.
  - JSON schema: Use `flattenSchema()` and set provider-specific `response_format` (OpenAI-style `json_schema`, Claude tools, or Gemini `responseSchema`).
  - Abort on client disconnect: create `AbortController`, `request.socket.on('close', () => controller.abort())` and pass `signal` to `fetch`.
- Adding a new provider (example workflow):
  1) Implement `async function sendFooRequest(req, res)` following patterns: build request body, convert messages, handle tools/JSON schema, attach headers, stream with `forwardFetchResponse()` or return JSON on success; log non-200 and include response text.
  2) Wire into `/generate` switch on `CHAT_COMPLETION_SOURCES.FOO` and `/status` for model list; define base URL and secret key in `src/endpoints/secrets.js` and constants in `src/constants.js` if needed.
  3) Respect `request.body.reverse_proxy` + `proxy_password` when present and default to user secrets otherwise (`readSecret(request.user.directories, SECRET_KEYS.FOO)`).
  4) For OpenAI-compatible providers, remember `logprobs` shape differences (Chat: `{logprobs: true, top_logprobs: n}`) and consider `text-completion` fallback via `TEXT_COMPLETION_MODELS`.

## Conventions & Utilities
- Module style: ESM only (`"type": "module"`). Use `import`/`export`, not `require`.
- Fetching: Use `node-fetch` and pipe streams via `forwardFetchResponse(response, expressRes)`.
- Errors: Log provider errors with status and text; when possible `tryParse()` JSON and return `{ error: true }` or more specific `{ error: { message } }` without leaking secrets.
- Headers: Some providers need extra headers (e.g., OpenRouter `OPENROUTER_HEADERS`, AIMLAPI `AIMLAPI_HEADERS`).
- Secrets: Stored per user in `data/<user>/secrets.json`; access with `readSecret(userDirs, SECRET_KEYS.<PROVIDER>)`.
- Tokenization/bias: `POST /api/backends/chat-completions/bias` computes token ID maps with SentencePiece/Web tokenizers or tiktoken. Use helpers in `src/endpoints/tokenizers.js`.
- Streaming vs non-streaming: Always branch on `request.body.stream`; non-streaming should parse JSON and send unified OpenAI-compatible shape when practical.

## Adding API Endpoints (non-LLM)
- Create an Express router in `src/endpoints/<feature>.js`, export `router`, then mount it in `setupPrivateEndpoints()` (private) or in `server-main.js` before `requireLoginMiddleware` (public).
- Use `multer` from `server-main.js` for file uploads (uploaded to `DATA_ROOT/_uploads`). Respect CSRF and auth positioning.

## File System & Logging
- Data caches: Character thumbnails and disk caches set up in `src/server-main.js` (`ensureThumbnailCache`, `diskCache.verify`).
- Access logs: When `listen: true`, access log is written; path via `getAccessLogPath()`.
- Colorized logging via `util.color`; debug logs use `console.debug` and are meaningful during provider integration.

## Linting
- Lint commands: `npm run lint` and `npm run lint:fix`. Project is lax on `var` (`no-var: off`) and `no-path-concat: off` as per `package.json`.

If anything here is unclear (e.g., secrets layout, CSRF boundaries, or adding a provider), ask and we’ll refine this guide.

## Mobile (Expo)
- Location: `mobile/` is an Expo Router app (React Native). Start with `npm install` then `npm run start` in `mobile/`. Useful scripts: `npm run web`, `npm run android`, `npm run test:importer`, `npm run test:serde`.
- Backend connectivity: Mobile can call providers directly or the server adapters. If calling server private endpoints, first GET `/csrf-token` and set `x-csrf-token`; ensure the server is reachable from the device (configure host/port in mobile settings).
- Environment caveats: RN lacks Node built-ins (`fs`, `path`, `Buffer`, streams). Use polyfills found in `mobile/polyfills/` and libraries like `buffer`, `expo-crypto`, `react-native-get-random-values`. Avoid Node-only libs (e.g., `jimp`, `simple-git`).
- Code reuse: Prefer copying/adapting pure functions from `src/prompt-converters.js` and selected constants from `src/constants.js` into `mobile/shared` or `mobile/src` without Node-specific imports.
- Streaming: Use providers’ SSE/chunked streaming readers in mobile. When hitting server adapters (e.g., `/api/backends/chat-completions/generate`), stream responses as-is; handle abort via `AbortController`.
- Secrets on mobile: Store API keys in `expo-secure-store`; non-sensitive data in `@react-native-async-storage/async-storage` via Zustand persistence.
- Role import: Mobile supports JSON and selected URL imports; PNG-card parsing may differ from desktop. See `mobile/README.md`; try `npm run test:importer` to validate importer flow (logs prefixed with `[role-importers]`).
- Dependencies (Expo SDK 54): `expo ~54`, `expo-router ~6`, `react-native 0.81`, `react 19`. If versions mismatch, run `npx expo install --fix`.

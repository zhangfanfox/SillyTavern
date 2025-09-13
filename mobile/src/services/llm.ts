import { useConnectionsStore } from '../stores/connections';
import { useParamsStore } from '../stores/params';
import { Buffer } from 'buffer';

export interface StreamCallbacks {
  onToken?: (t: string) => void;
  onDone?: () => void;
  onError?: (e: any) => void;
  onDebug?: (e: { provider: string; url: string; phase: 'request' | 'response' | 'error'; request?: any; response?: any; status?: number; error?: any }) => void;
}

export function createAbortController() {
  return new AbortController();
}

export async function streamOpenAIChat(opts: {
  connectionId: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  params?: Record<string, any>;
  controller?: AbortController;
} & StreamCallbacks) {
  const { connectionId, messages, params, onToken, onDone, onError, onDebug } = opts;
  const controller = opts.controller ?? new AbortController();

  // Resolve connection
  const { items, getSecretKey } = useConnectionsStore.getState();
  const meta = items.find((x) => x.id === connectionId) ?? items.find((x) => x.isDefault);
  if (!meta) throw new Error('No default API connection configured');
  const apiKey = await getSecretKey(meta.id);
  if (!apiKey) throw new Error('API key missing for selected connection');

  const url = (meta.baseUrl ?? 'https://api.openai.com') + '/v1/chat/completions';
  const body = {
    model: meta.model ?? 'gpt-4o-mini',
    stream: true,
    messages,
    ...params,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    onDebug?.({ provider: 'openai', url, phase: 'request', request: body });
    const anyRes = res as any;
    if (!res.ok || !anyRes.body) throw new Error(`HTTP ${res.status}`);

    const reader = anyRes.body.getReader();
    let done = false;
    let leftover = '';
    while (!done) {
      const chunk = await reader.read();
      done = !!chunk.done;
      if (chunk.value) {
        const text = Buffer.from(chunk.value).toString('utf8');
        const combined = leftover + text;
        const lines = combined.split(/\r?\n/);
        leftover = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            onDone?.();
            return;
          }
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) onToken?.(delta);
          } catch (e) {
            // ignore parsing error of non-JSON lines
          }
        }
      }
    }
    onDone?.();
  } catch (e) {
    if ((e as any)?.name === 'AbortError') return; // canceled
    onError?.(e);
    onDebug?.({ provider: 'openai', url, phase: 'error', error: String(e) });
  }
}

export async function streamClaudeChat(opts: {
  connectionId: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  params?: Record<string, any>;
  controller?: AbortController;
} & StreamCallbacks) {
  const { connectionId, messages, params, onToken, onDone, onError, onDebug } = opts;
  const controller = opts.controller ?? new AbortController();

  const { items, getSecretKey } = useConnectionsStore.getState();
  const meta = items.find((x) => x.id === connectionId) ?? items.find((x) => x.isDefault);
  if (!meta) throw new Error('No default API connection configured');
  const apiKey = await getSecretKey(meta.id);
  if (!apiKey) throw new Error('API key missing for selected connection');

  const url = (meta.baseUrl ?? 'https://api.anthropic.com') + '/v1/messages';

  // Map to Anthropic format
  const sys = messages.find((m) => m.role === 'system')?.content;
  const anthropicMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  const body = {
    model: meta.model ?? 'claude-3-5-haiku-latest',
    stream: true,
    system: sys,
    messages: anthropicMessages,
    ...params,
  } as any;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    onDebug?.({ provider: 'claude', url, phase: 'request', request: body });
    const anyRes = res as any;
    if (!res.ok || !anyRes.body) throw new Error(`HTTP ${res.status}`);

    const reader = anyRes.body.getReader();
    let done = false;
    let leftover = '';
    while (!done) {
      const chunk = await reader.read();
      done = !!chunk.done;
      if (chunk.value) {
        const text = Buffer.from(chunk.value).toString('utf8');
        const combined = leftover + text;
        const lines = combined.split(/\r?\n/);
        leftover = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            onDone?.();
            return;
          }
          try {
            const json = JSON.parse(data);
            // Claude SSE events have structure with type 'message_delta' and 'content_block_delta'
            const type = json.type as string | undefined;
            if (type === 'content_block_delta') {
              const t = json.delta?.text ?? json.delta?.partial ?? json.delta;
              if (t) onToken?.(String(t));
            }
          } catch {}
        }
      }
    }
    onDone?.();
  } catch (e) {
    if ((e as any)?.name === 'AbortError') return;
    onError?.(e);
    onDebug?.({ provider: 'claude', url, phase: 'error', error: String(e) });
  }
}

export async function streamChat(opts: {
  connectionId?: string; // if missing, use default
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  controller?: AbortController;
} & StreamCallbacks) {
  const { items } = useConnectionsStore.getState();
  const meta = opts.connectionId
    ? items.find((x) => x.id === opts.connectionId)
    : items.find((x) => x.isDefault);
  if (!meta) throw new Error('No default API connection configured');

  const params = useParamsStore.getState().get(meta.id) ?? {};

  if (meta.provider === 'openai' || meta.provider === 'openrouter') {
    return streamOpenAIChat({ connectionId: meta.id, messages: opts.messages, params, controller: opts.controller, onToken: opts.onToken, onDone: opts.onDone, onError: opts.onError, onDebug: opts.onDebug });
  }
  if (meta.provider === 'claude') {
    return streamClaudeChat({ connectionId: meta.id, messages: opts.messages, params, controller: opts.controller, onToken: opts.onToken, onDone: opts.onDone, onError: opts.onError, onDebug: opts.onDebug });
  }
  if (meta.provider === 'gemini') {
    return streamGeminiChat({ connectionId: meta.id, messages: opts.messages, params, controller: opts.controller, onToken: opts.onToken, onDone: opts.onDone, onError: opts.onError, onDebug: opts.onDebug });
  }
  throw new Error(`Provider ${meta.provider} not yet supported`);
}

// Quick connectivity test, similar to web's "连接/发送测试消息" idea. Returns boolean and updates validity flag in store.
export async function testConnection(connectionId?: string): Promise<boolean> {
  const { items, getSecretKey, setValidity } = useConnectionsStore.getState();
  const meta = connectionId ? items.find((x) => x.id === connectionId) : items.find((x) => x.isDefault);
  if (!meta) throw new Error('No default API connection configured');
  const apiKey = await getSecretKey(meta.id);
  if (!apiKey) {
    setValidity(meta.id, false);
    return false;
  }

  try {
    if (meta.provider === 'openai' || meta.provider === 'openrouter') {
      const url = (meta.baseUrl ?? 'https://api.openai.com') + '/v1/models';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      const ok = res.ok;
      setValidity(meta.id, ok);
      return ok;
    }
    if (meta.provider === 'claude') {
      const url = (meta.baseUrl ?? 'https://api.anthropic.com') + '/v1/models';
      const res = await fetch(url, { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } });
      const ok = res.ok;
      setValidity(meta.id, ok);
      return ok;
    }
    if (meta.provider === 'gemini') {
      // a lightweight call to list models would require Vertex or makersuite endpoint; use a ping by fetching a known model info
      // GET https://generativelanguage.googleapis.com/v1/models/gemini-pro?key=API_KEY
      const model = meta.model || 'gemini-pro';
      const base = (meta.baseUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
      const url = `${base}/v1/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      const ok = res.ok;
      setValidity(meta.id, ok);
      return ok;
    }
  } catch {
    // fall through
  }
  setValidity(meta.id, false);
  return false;
}

export async function testConnectionRaw(meta: {
  provider: 'openai' | 'openrouter' | 'claude' | 'gemini';
  baseUrl?: string;
  model?: string;
}, apiKey: string): Promise<boolean> {
  try {
    if (!apiKey) return false;
    if (meta.provider === 'openai' || meta.provider === 'openrouter') {
      const url = (meta.baseUrl ?? 'https://api.openai.com') + '/v1/models';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      return res.ok;
    }
    if (meta.provider === 'claude') {
      const url = (meta.baseUrl ?? 'https://api.anthropic.com') + '/v1/models';
      const res = await fetch(url, { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } });
      return res.ok;
    }
    if (meta.provider === 'gemini') {
      const model = meta.model || 'gemini-pro';
      const base = (meta.baseUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
      const url = `${base}/v1/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      return res.ok;
    }
  } catch {
    // ignore
  }
  return false;
}
export async function streamGeminiChat(opts: {
  connectionId: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  params?: Record<string, any>;
  controller?: AbortController;
} & StreamCallbacks) {
  const { connectionId, messages, params, onToken, onDone, onError, onDebug } = opts;
  const controller = opts.controller ?? new AbortController();

  const { items, getSecretKey } = useConnectionsStore.getState();
  const meta = items.find((x) => x.id === connectionId) ?? items.find((x) => x.isDefault);
  if (!meta) throw new Error('No default API connection configured');
  const apiKey = await getSecretKey(meta.id);
  if (!apiKey) throw new Error('API key missing for selected connection');

  const base = (meta.baseUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const model = meta.model || 'gemini-pro';
  const url = `${base}/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const sys = messages.find((m) => m.role === 'system')?.content;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  // Map typical params to Gemini generationConfig
  const generationConfig: Record<string, any> = {};
  const topP = params?.top_p ?? params?.topP;
  const temperature = params?.temperature;
  const maxOutputTokens = params?.max_output_tokens ?? params?.maxOutputTokens;
  if (typeof topP === 'number') generationConfig.topP = topP;
  if (typeof temperature === 'number') generationConfig.temperature = temperature;
  if (typeof maxOutputTokens === 'number') generationConfig.maxOutputTokens = maxOutputTokens;

  const body: any = {
    contents,
  };
  // Note: Google AI Studio v1 endpoint does NOT accept `systemInstruction`.
  // If we later switch to v1beta, we can include it conditionally.
  // For now, omit system instruction to avoid 400 "Unknown name 'systemInstruction'".
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    onDebug?.({ provider: 'gemini', url, phase: 'request', request: body });
    if (!res.ok) {
      let respText: any = undefined;
      try { respText = await res.text(); } catch {}
      onDebug?.({ provider: 'gemini', url, phase: 'response', status: res.status, response: respText });
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    onDebug?.({ provider: 'gemini', url, phase: 'response', status: res.status, response: json });
    // Aggregate text from candidates
    const text = (json?.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p?.text)
      .filter(Boolean)
      .join('');
    if (text) onToken?.(text);
    onDone?.();
  } catch (e) {
    if ((e as any)?.name === 'AbortError') return;
    onError?.(e);
    onDebug?.({ provider: 'gemini', url, phase: 'error', error: String(e) });
  }
}

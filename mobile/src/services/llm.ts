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

// Non-streaming variant for OpenAI-compatible
export async function nonStreamOpenAIChat(opts: {
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

  const url = (meta.baseUrl ?? 'https://api.openai.com') + '/v1/chat/completions';
  const body = { model: meta.model ?? 'gpt-4o-mini', stream: false, messages, ...params };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body), signal: controller.signal });
    onDebug?.({ provider: 'openai', url, phase: 'request', request: body });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? '';
    if (text) onToken?.(text);
    onDone?.();
  } catch (e) {
    if ((e as any)?.name === 'AbortError') return; onError?.(e); onDebug?.({ provider: 'openai', url, phase: 'error', error: String(e) });
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

// Non-streaming variant for Claude
export async function nonStreamClaudeChat(opts: {
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
  const sys = messages.find((m) => m.role === 'system')?.content;
  const anthropicMessages = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
  const body: any = { model: meta.model ?? 'claude-3-5-haiku-latest', stream: false, system: sys, messages: anthropicMessages, ...params };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body), signal: controller.signal });
    onDebug?.({ provider: 'claude', url, phase: 'request', request: body });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // Non-stream response has content blocks
    const text = json?.content?.map((b: any) => b?.text).filter(Boolean).join('') ?? '';
    if (text) onToken?.(text);
    onDone?.();
  } catch (e) {
    if ((e as any)?.name === 'AbortError') return; onError?.(e); onDebug?.({ provider: 'claude', url, phase: 'error', error: String(e) });
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

  const preferStream = meta.preferStream ?? true;
  if (meta.provider === 'openai' || meta.provider === 'openrouter') {
    return preferStream
      ? streamOpenAIChat({ connectionId: meta.id, messages: opts.messages, params, controller: opts.controller, onToken: opts.onToken, onDone: opts.onDone, onError: opts.onError, onDebug: opts.onDebug })
      : nonStreamOpenAIChat({ connectionId: meta.id, messages: opts.messages, params, controller: opts.controller, onToken: opts.onToken, onDone: opts.onDone, onError: opts.onError, onDebug: opts.onDebug });
  }
  if (meta.provider === 'claude') {
    return preferStream
      ? streamClaudeChat({ connectionId: meta.id, messages: opts.messages, params, controller: opts.controller, onToken: opts.onToken, onDone: opts.onDone, onError: opts.onError, onDebug: opts.onDebug })
      : nonStreamClaudeChat({ connectionId: meta.id, messages: opts.messages, params, controller: opts.controller, onToken: opts.onToken, onDone: opts.onDone, onError: opts.onError, onDebug: opts.onDebug });
  }
  if (meta.provider === 'gemini') {
    return preferStream
      ? streamGeminiChat({ connectionId: meta.id, messages: opts.messages, params, controller: opts.controller, onToken: opts.onToken, onDone: opts.onDone, onError: opts.onError, onDebug: opts.onDebug })
      : nonStreamGeminiChat({ connectionId: meta.id, messages: opts.messages, params, controller: opts.controller, onToken: opts.onToken, onDone: opts.onDone, onError: opts.onError, onDebug: opts.onDebug });
  }
  throw new Error(`Provider ${meta.provider} not yet supported`);
}

// Quick connectivity test, similar to web's "连接/发送测试消息" idea. Returns boolean and updates validity flag in store.
export async function testConnection(connectionId?: string, opts?: { onDebug?: (e: { provider: string; url: string; phase: 'request' | 'response' | 'error'; request?: any; response?: any; status?: number; error?: any }) => void }): Promise<boolean> {
  const { items, getSecretKey, setValidity } = useConnectionsStore.getState();
  const meta = connectionId ? items.find((x) => x.id === connectionId) : items.find((x) => x.isDefault);
  if (!meta) throw new Error('No default API connection configured');
  const apiKey = await getSecretKey(meta.id);
  if (!apiKey) {
    setValidity(meta.id, false);
    return false;
  }

  try {
    const preferStream = meta.preferStream ?? true;
    const pingMsg = [{ role: 'user', content: 'ping' }];

    if (meta.provider === 'openai' || meta.provider === 'openrouter') {
      const url = (meta.baseUrl ?? 'https://api.openai.com') + '/v1/chat/completions';
      const body = { model: meta.model ?? 'gpt-4o-mini', stream: !!preferStream, messages: pingMsg };
      opts?.onDebug?.({ provider: 'openai', url, phase: 'request', request: body });
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
      const ok = res.ok;
      let resp: any = undefined; try { resp = await res.text(); } catch {}
      opts?.onDebug?.({ provider: 'openai', url, phase: 'response', status: res.status, response: resp });
      setValidity(meta.id, ok);
      return ok;
    }
    if (meta.provider === 'claude') {
      const url = (meta.baseUrl ?? 'https://api.anthropic.com') + '/v1/messages';
      const body = { model: meta.model ?? 'claude-3-5-haiku-latest', stream: !!preferStream, system: undefined, messages: pingMsg } as any;
      opts?.onDebug?.({ provider: 'claude', url, phase: 'request', request: body });
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
      const ok = res.ok;
      let resp: any = undefined; try { resp = await res.text(); } catch {}
      opts?.onDebug?.({ provider: 'claude', url, phase: 'response', status: res.status, response: resp });
      setValidity(meta.id, ok);
      return ok;
    }
    if (meta.provider === 'gemini') {
      const base = (meta.baseUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
      const model = meta.model || 'gemini-pro';
      const url = preferStream
        ? `${base}/v1/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
        : `${base}/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const headers: any = { 'Content-Type': 'application/json' };
      if (preferStream) headers.Accept = 'text/event-stream';
      const body = { contents: [{ role: 'user', parts: [{ text: 'ping' }] }] } as any;
      opts?.onDebug?.({ provider: 'gemini', url, phase: 'request', request: body });
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const ok = res.ok;
      let resp: any = undefined; try { resp = await res.text(); } catch {}
      opts?.onDebug?.({ provider: 'gemini', url, phase: 'response', status: res.status, response: resp });
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
  preferStream?: boolean;
}, apiKey: string, opts?: { onDebug?: (e: { provider: string; url: string; phase: 'request' | 'response' | 'error'; request?: any; response?: any; status?: number; error?: any }) => void }): Promise<boolean> {
  try {
    if (!apiKey) return false;
    const preferStream = meta.preferStream ?? true;
    const pingMsg = [{ role: 'user', content: 'ping' }];

    if (meta.provider === 'openai' || meta.provider === 'openrouter') {
      const url = (meta.baseUrl ?? 'https://api.openai.com') + '/v1/chat/completions';
      const body = { model: meta.model ?? 'gpt-4o-mini', stream: !!preferStream, messages: pingMsg } as any;
      opts?.onDebug?.({ provider: 'openai', url, phase: 'request', request: body });
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
      let resp: any = undefined; try { resp = await res.text(); } catch {}
      opts?.onDebug?.({ provider: 'openai', url, phase: 'response', status: res.status, response: resp });
      return preferStream ? (res as any).ok && !!(res as any).body : res.ok;
    }
    if (meta.provider === 'claude') {
      const url = (meta.baseUrl ?? 'https://api.anthropic.com') + '/v1/messages';
      const body = { model: meta.model ?? 'claude-3-5-haiku-latest', stream: !!preferStream, system: undefined, messages: pingMsg } as any;
      opts?.onDebug?.({ provider: 'claude', url, phase: 'request', request: body });
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
      let resp: any = undefined; try { resp = await res.text(); } catch {}
      opts?.onDebug?.({ provider: 'claude', url, phase: 'response', status: res.status, response: resp });
      return preferStream ? (res as any).ok && !!(res as any).body : res.ok;
    }
    if (meta.provider === 'gemini') {
      const model = meta.model || 'gemini-pro';
      const base = (meta.baseUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
      if (preferStream) {
        const url = `${base}/v1/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
        const body = { contents: [{ role: 'user', parts: [{ text: 'ping' }] }] } as any;
        opts?.onDebug?.({ provider: 'gemini', url, phase: 'request', request: body });
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify(body) });
        let resp: any = undefined; try { resp = await res.text(); } catch {}
        opts?.onDebug?.({ provider: 'gemini', url, phase: 'response', status: res.status, response: resp });
        return res.ok;
      } else {
        const url = `${base}/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const body = { contents: [{ role: 'user', parts: [{ text: 'ping' }] }] } as any;
        opts?.onDebug?.({ provider: 'gemini', url, phase: 'request', request: body });
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        let resp: any = undefined; try { resp = await res.text(); } catch {}
        opts?.onDebug?.({ provider: 'gemini', url, phase: 'response', status: res.status, response: resp });
        return res.ok;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

  // Provider-specific small-call tests
  export async function testConnectionStream(connectionId: string): Promise<boolean> {
    const { items, getSecretKey } = useConnectionsStore.getState();
    const meta = items.find((x) => x.id === connectionId);
    if (!meta) throw new Error('Connection not found');
    const apiKey = await getSecretKey(meta.id);
    if (!apiKey) return false;
    try {
      if (meta.provider === 'openai' || meta.provider === 'openrouter') {
        const url = (meta.baseUrl ?? 'https://api.openai.com') + '/v1/chat/completions';
        const body = { model: meta.model ?? 'gpt-4o-mini', stream: true, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] } as any;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
        const anyRes = res as any;
        if (!res.ok || !anyRes.body) return false;
        const reader = anyRes.body.getReader();
        const chunk = await reader.read();
        return !!chunk.value;
      }
      if (meta.provider === 'claude') {
        const url = (meta.baseUrl ?? 'https://api.anthropic.com') + '/v1/messages';
        const body = { model: meta.model ?? 'claude-3-5-haiku-latest', stream: true, max_tokens: 32, messages: [{ role: 'user', content: 'ping' }] } as any;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
        const anyRes = res as any;
        if (!res.ok || !anyRes.body) return false;
        const reader = anyRes.body.getReader();
        const chunk = await reader.read();
        return !!chunk.value;
      }
      if (meta.provider === 'gemini') {
        const base = (meta.baseUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
        const model = meta.model || 'gemini-pro';
        const url = `${base}/v1/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
        const body = { contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 1 } } as any;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify(body) });
        const anyRes = res as any;
        if (!res.ok || !anyRes.body) return false;
        const reader = anyRes.body.getReader();
        const chunk = await reader.read();
        return !!chunk.value;
      }
    } catch {}
    return false;
  }

  export async function testConnectionNonStream(connectionId: string): Promise<boolean> {
    const { items, getSecretKey } = useConnectionsStore.getState();
    const meta = items.find((x) => x.id === connectionId);
    if (!meta) throw new Error('Connection not found');
    const apiKey = await getSecretKey(meta.id);
    if (!apiKey) return false;
    try {
      if (meta.provider === 'openai' || meta.provider === 'openrouter') {
        const url = (meta.baseUrl ?? 'https://api.openai.com') + '/v1/chat/completions';
        const body = { model: meta.model ?? 'gpt-4o-mini', stream: false, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] } as any;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
        if (!res.ok) return false; const json = await res.json();
        return !!json?.choices?.[0]?.message?.content;
      }
      if (meta.provider === 'claude') {
        const url = (meta.baseUrl ?? 'https://api.anthropic.com') + '/v1/messages';
        const body = { model: meta.model ?? 'claude-3-5-haiku-latest', stream: false, max_tokens: 32, messages: [{ role: 'user', content: 'ping' }] } as any;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
        if (!res.ok) return false; const json = await res.json();
        const text = json?.content?.map((b: any) => b?.text).filter(Boolean).join('');
        return !!text;
      }
      if (meta.provider === 'gemini') {
        const base = (meta.baseUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
        const model = meta.model || 'gemini-pro';
        const url = `${base}/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const body = { contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 1 } } as any;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) return false; const json = await res.json();
        const text = (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text).filter(Boolean).join('');
        return !!text;
      }
    } catch {}
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
  // Use streaming endpoint with SSE
  const url = `${base}/v1/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

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
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    onDebug?.({ provider: 'gemini', url, phase: 'request', request: body });
    const anyRes = res as any;
    if (!res.ok || !anyRes.body) {
      let respText: any = undefined;
      try { respText = await res.text(); } catch {}
      onDebug?.({ provider: 'gemini', url, phase: 'response', status: res.status, response: respText });
      throw new Error(`HTTP ${res.status}`);
    }

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
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            onDone?.();
            return;
          }
          try {
            const evt = JSON.parse(dataStr);
            // Gemini stream events often include candidates[0].content.parts[].text
            const parts = evt?.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              for (const p of parts) {
                const t = p?.text;
                if (t) onToken?.(String(t));
              }
            }
          } catch {
            // ignore parse errors for non-JSON SSE noise
          }
        }
      }
    }
    onDone?.();
  } catch (e) {
    if ((e as any)?.name === 'AbortError') return;
    onError?.(e);
    onDebug?.({ provider: 'gemini', url, phase: 'error', error: String(e) });
  }
}

// Non-streaming Gemini call using generateContent
export async function nonStreamGeminiChat(opts: {
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

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const generationConfig: Record<string, any> = {};
  const topP = params?.top_p ?? params?.topP;
  const temperature = params?.temperature;
  const maxOutputTokens = params?.max_output_tokens ?? params?.maxOutputTokens;
  if (typeof topP === 'number') generationConfig.topP = topP;
  if (typeof temperature === 'number') generationConfig.temperature = temperature;
  if (typeof maxOutputTokens === 'number') generationConfig.maxOutputTokens = maxOutputTokens;

  const body: any = { contents };
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    onDebug?.({ provider: 'gemini', url, phase: 'request', request: body });
    if (!res.ok) {
      let respText: any = undefined;
      try { respText = await res.text(); } catch {}
      onDebug?.({ provider: 'gemini', url, phase: 'response', status: res.status, response: respText });
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    onDebug?.({ provider: 'gemini', url, phase: 'response', status: 200, response: json });
    const text = (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text).filter(Boolean).join('');
    if (text) onToken?.(text);
    onDone?.();
  } catch (e) {
    if ((e as any)?.name === 'AbortError') return; onError?.(e); onDebug?.({ provider: 'gemini', url, phase: 'error', error: String(e) });
  }
}

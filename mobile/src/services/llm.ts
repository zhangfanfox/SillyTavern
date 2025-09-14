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

// XHR-based SSE fallback for React Native environments where fetch streaming isn't available
async function streamSSEWithXHR(opts: {
  url: string;
  method?: 'POST' | 'GET';
  headers?: Record<string, string>;
  body?: string;
  controller: AbortController;
  onEvent: (data: any) => void; // JSON parsed per data: line
  onDone: () => void;
  onError: (e: any) => void;
}) {
  try {
    const xhr = new XMLHttpRequest();
    let lastIndex = 0;
    let buffer = '';
    xhr.open(opts.method ?? 'POST', opts.url);
    if (opts.headers) {
      for (const [k, v] of Object.entries(opts.headers)) xhr.setRequestHeader(k, v);
    }
  // Encourage progressive delivery from proxies
    try { xhr.setRequestHeader('Cache-Control', 'no-cache, no-transform'); } catch {}
    try { xhr.setRequestHeader('Accept', 'text/event-stream'); } catch {}
    const cleanUp = () => {
      try { xhr.onreadystatechange = null as any; } catch {}
      try { xhr.onprogress = null as any; } catch {}
      try { xhr.onerror = null as any; } catch {}
    };
    const processChunk = () => {
      try {
        const resp = xhr.responseText || '';
        if (resp.length <= lastIndex) return;
        const chunk = resp.slice(lastIndex);
        lastIndex = resp.length;
        buffer += chunk;
        // Process complete SSE event blocks separated by two newlines (handle both \n\n and \r\n\r\n)
        let sepIdx = -1;
        while (true) {
          const lfIdx = buffer.indexOf('\n\n');
          const crlfIdx = buffer.indexOf('\r\n\r\n');
          if (lfIdx === -1 && crlfIdx === -1) break;
          sepIdx = lfIdx !== -1 && (crlfIdx === -1 || lfIdx < crlfIdx) ? lfIdx : crlfIdx;
          const sepLen = sepIdx === lfIdx ? 2 : 4;
          const block = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + sepLen);
          const lines = block.split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') {
              opts.onDone();
              try { cleanUp(); } catch {}
              try { xhr.abort(); } catch {}
              return;
            }
            try {
              const json = JSON.parse(data);
              opts.onEvent(json);
            } catch {}
          }
        }
      } catch {}
    };
    xhr.onprogress = processChunk;
    xhr.onreadystatechange = () => {
      if (xhr.readyState === xhr.HEADERS_RECEIVED /* 2 */) {
        // If status is error, we will still collect responseText in DONE to surface details
      }
      if (xhr.readyState === xhr.LOADING /* 3 */ || xhr.readyState === xhr.DONE /* 4 */) {
        processChunk();
        if (xhr.readyState === xhr.DONE) {
          // Surface HTTP errors with response payload for debugging
          if (xhr.status && (xhr.status < 200 || xhr.status >= 300)) {
            const resp = xhr.responseText;
            opts.onError({ status: xhr.status, response: resp });
          } else {
            opts.onDone();
          }
          cleanUp();
        }
      }
    };
    xhr.onerror = (e) => {
      cleanUp();
      opts.onError(e);
    };
    opts.controller.signal.addEventListener('abort', () => {
      try { xhr.abort(); } catch {}
      cleanUp();
    });
    xhr.send(opts.body ?? null);
  } catch (e) {
    opts.onError(e);
  }
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
    onDebug?.({ provider: 'openai', url, phase: 'request', request: body });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const anyRes = res as any;
    if (!res.ok) {
      let respText: any = undefined;
      try { respText = await res.text(); } catch {}
      onDebug?.({ provider: 'openai', url, phase: 'response', status: res.status, response: respText });
      throw new Error(`HTTP ${res.status}`);
    }
    // Successful streaming response opened
    onDebug?.({ provider: 'openai', url, phase: 'response', status: res.status, response: 'SSE stream opened' });
    if (!anyRes.body) {
      // Fallback to XHR progressive streaming
      await streamSSEWithXHR({
        url,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Accept: 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
        body: JSON.stringify(body),
        controller,
        onEvent: (json) => {
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) onToken?.(delta);
        },
        onDone: () => onDone?.(),
        onError: (e) => { onError?.(e); onDebug?.({ provider: 'openai', url, phase: 'error', error: String(e) }); },
      });
      return;
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
    onDebug?.({ provider: 'openai', url, phase: 'response', status: 200, response: json });
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
    onDebug?.({ provider: 'claude', url, phase: 'request', request: body });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const anyRes = res as any;
    if (!res.ok) {
      let respText: any = undefined;
      try { respText = await res.text(); } catch {}
      onDebug?.({ provider: 'claude', url, phase: 'response', status: res.status, response: respText });
      throw new Error(`HTTP ${res.status}`);
    }
    // Successful streaming response opened
    onDebug?.({ provider: 'claude', url, phase: 'response', status: res.status, response: 'SSE stream opened' });
    if (!anyRes.body) {
      await streamSSEWithXHR({
        url,
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', Accept: 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
        body: JSON.stringify(body),
        controller,
        onEvent: (json) => {
          const type = json.type as string | undefined;
          if (type === 'content_block_delta') {
            const t = json.delta?.text ?? json.delta?.partial ?? json.delta;
            if (t) onToken?.(String(t));
          }
        },
        onDone: () => onDone?.(),
        onError: (e) => { onError?.(e); onDebug?.({ provider: 'claude', url, phase: 'error', error: String(e) }); },
      });
      return;
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
    onDebug?.({ provider: 'claude', url, phase: 'response', status: 200, response: json });
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
    onDebug?.({ provider: 'gemini', url, phase: 'request', request: body });
    // Retry on 503 UNAVAILABLE a few times with exponential backoff
    const maxAttempts = 3;
    let attempt = 0;
    let res: Response | null = null;
    while (attempt < maxAttempts) {
      attempt++;
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status !== 503) break;
      onDebug?.({ provider: 'gemini', url, phase: 'response', status: res.status, response: 'Model overloaded, retrying...' });
      // backoff: 500ms, 1500ms
      const delay = 500 * Math.pow(3, attempt - 1);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
    const anyRes = (res as Response) as any;
    if (!res || !res.ok) {
      let respText: any = undefined;
      try { respText = await res?.text(); } catch {}
      onDebug?.({ provider: 'gemini', url, phase: 'response', status: res?.status, response: respText });
      throw new Error(`HTTP ${res?.status}`);
    }
    // Success path
    if (!anyRes.body) {
      // Fallback to XHR progressive SSE
      await streamSSEWithXHR({
        url,
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
        body: JSON.stringify(body),
        controller,
        onEvent: (evt) => {
          const parts = evt?.candidates?.[0]?.content?.parts;
          if (Array.isArray(parts)) {
            for (const p of parts) {
              const t = p?.text; if (t) onToken?.(String(t));
            }
          }
        },
        onDone: () => onDone?.(),
        onError: (e) => { onError?.(e); onDebug?.({ provider: 'gemini', url, phase: 'error', error: String(e) }); },
      });
      return;
    }

  onDebug?.({ provider: 'gemini', url, phase: 'response', status: (res as Response).status, response: 'SSE stream opened' });
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
    // Retry on 503
    const maxAttempts = 3;
    let attempt = 0;
    let res: Response | null = null;
    while (attempt < maxAttempts) {
      attempt++;
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      if (res.status !== 503) break;
      onDebug?.({ provider: 'gemini', url, phase: 'response', status: res.status, response: 'Model overloaded, retrying...' });
      const delay = 500 * Math.pow(3, attempt - 1);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
    onDebug?.({ provider: 'gemini', url, phase: 'request', request: body });
    if (!res || !res.ok) {
      let respText: any = undefined;
      try { respText = await res?.text(); } catch {}
      onDebug?.({ provider: 'gemini', url, phase: 'response', status: res?.status, response: respText });
      throw new Error(`HTTP ${res?.status}`);
    }
    const json = await (res as Response).json();
    onDebug?.({ provider: 'gemini', url, phase: 'response', status: 200, response: json });
    const text = (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text).filter(Boolean).join('');
    if (text) onToken?.(text);
    onDone?.();
  } catch (e) {
    if ((e as any)?.name === 'AbortError') return; onError?.(e); onDebug?.({ provider: 'gemini', url, phase: 'error', error: String(e) });
  }
}

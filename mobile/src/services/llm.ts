import { useConnectionsStore } from '../stores/connections';
import { useParamsStore } from '../stores/params';
import { Buffer } from 'buffer';

export interface StreamCallbacks {
  onToken?: (t: string) => void;
  onDone?: () => void;
  onError?: (e: any) => void;
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
  const { connectionId, messages, params, onToken, onDone, onError } = opts;
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
  }
}

export async function streamClaudeChat(opts: {
  connectionId: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  params?: Record<string, any>;
  controller?: AbortController;
} & StreamCallbacks) {
  const { connectionId, messages, params, onToken, onDone, onError } = opts;
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
    return streamOpenAIChat({ connectionId: meta.id, messages: opts.messages, params, controller: opts.controller, onToken: opts.onToken, onDone: opts.onDone, onError: opts.onError });
  }
  if (meta.provider === 'claude') {
    return streamClaudeChat({ connectionId: meta.id, messages: opts.messages, params, controller: opts.controller, onToken: opts.onToken, onDone: opts.onDone, onError: opts.onError });
  }
  // gemini TODO
  throw new Error(`Provider ${meta.provider} not yet supported`);
}

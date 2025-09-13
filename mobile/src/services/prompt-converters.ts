export const PROMPT_PROCESSING_TYPE = {
  NONE: '',
  MERGE: 'merge',
  SEMI: 'semi',
  STRICT: 'strict',
  SINGLE: 'single',
  TOOLS: 'tools',
} as const;

export type RoleNameTriplet = {
  charName?: string;
  userName?: string;
  groupNames?: string[];
  startsWithGroupName?: (s: string) => boolean;
};

type ToolCallPart = { type: 'tool_use'; name: string; arguments?: any; id?: string } | { type: 'tool_result'; name?: string; content?: any; id?: string };
type MediaPart = { type: 'image' | 'image_url' | 'video'; url?: string; mimeType?: string; alt?: string };
type TextPart = { type: 'text'; text: string };
type ChatPart = TextPart | MediaPart | ToolCallPart;
type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string | ChatPart[] };

function toTextWithMedia(m: ChatMsg): string {
  if (typeof m.content === 'string') return m.content || '';
  const parts = m.content as ChatPart[];
  const out: string[] = [];
  for (const p of parts) {
    if ((p as TextPart).type === 'text') {
      const t = (p as TextPart).text ?? '';
      if (t) out.push(t);
      continue;
    }
    if ((p as MediaPart).type === 'image' || (p as MediaPart).type === 'image_url') {
      const mp = p as MediaPart;
      out.push(`[Image${mp.url ? `: ${mp.url}` : ''}]`);
      continue;
    }
    if ((p as MediaPart).type === 'video') {
      const mp = p as MediaPart;
      out.push(`[Video${mp.url ? `: ${mp.url}` : ''}]`);
      continue;
    }
    // Basic tool markers when tools are present but not natively supported by provider
    const tp = p as ToolCallPart as any;
    if (tp?.type === 'tool_use') {
      out.push(`<tool_call name="${tp.name || ''}" args=${JSON.stringify(tp.arguments ?? {})} id="${tp.id || ''}"/>`);
      continue;
    }
    if (tp?.type === 'tool_result') {
      const c = typeof tp.content === 'string' ? tp.content : JSON.stringify(tp.content ?? null);
      out.push(`<tool_result name="${tp.name || ''}" id="${tp.id || ''}">${c}</tool_result>`);
      continue;
    }
  }
  return out.join('\n\n');
}

function withPrefixes(role: 'user' | 'assistant', text: string, names: RoleNameTriplet, useExamplePrefixes: boolean): string {
  if (!useExamplePrefixes) return text;
  const prefix = role === 'user' ? 'example_user' : 'example_assistant';
  return `${prefix}: ${text}`;
}

export function mergeMessages(messages: ChatMsg[], names: RoleNameTriplet, { strict = false, semi = false, single = false, tools = false, useExamplePrefixes = false }: { strict?: boolean; semi?: boolean; single?: boolean; tools?: boolean; useExamplePrefixes?: boolean } = {}): ChatMsg[] {
  const out: ChatMsg[] = [];
  const toText = (m: ChatMsg) => toTextWithMedia(m);
  const add = (m: ChatMsg) => {
    const content = toText(m);
    if (!out.length) return out.push({ role: m.role, content });
    const last = out[out.length - 1];
    if (last.role === m.role) {
      last.content = [last.content, content].filter(Boolean).join('\n\n');
    } else {
      out.push({ role: m.role, content });
    }
  };
  messages.forEach((m) => add(m));

  if (single) {
    // Collapse into a single user message. Include system first.
    const sys = out.find((m) => m.role === 'system')?.content as string | undefined;
    const rest = out.filter((m) => m.role !== 'system');
    const lines: string[] = [];
    if (sys) lines.push(sys);
    for (const r of rest) {
      if (r.role === 'user' || r.role === 'assistant') {
        lines.push(withPrefixes(r.role, String(r.content || ''), names, useExamplePrefixes));
      } else {
        lines.push(String(r.content || ''));
      }
    }
    const content = lines.filter(Boolean).join('\n\n');
    return [{ role: 'user', content }];
  }

  if (strict || semi) {
    for (let i = 1; i < out.length; i++) if (out[i].role === 'system') out[i].role = 'user';
    if (out.length === 0) out.push({ role: 'user', content: "Let's get started." });
    // Apply example_* prefixes in SEMI/STRICT per request
    for (const m of out) {
      if (m.role === 'user' || m.role === 'assistant') {
        m.content = withPrefixes(m.role, String(m.content || ''), names, useExamplePrefixes);
      }
    }
  }
  // TOOLS mode currently mirrors strict merging + preserves basic tool markers via toTextWithMedia
  if (tools) {
    for (let i = 1; i < out.length; i++) if (out[i].role === 'system') out[i].role = 'user';
    if (useExamplePrefixes) {
      for (const m of out) {
        if (m.role === 'user' || m.role === 'assistant') {
          m.content = withPrefixes(m.role, String(m.content || ''), names, true);
        }
      }
    }
  }
  return out;
}

export function postProcessPrompt(messages: ChatMsg[], type: (typeof PROMPT_PROCESSING_TYPE)[keyof typeof PROMPT_PROCESSING_TYPE], names: RoleNameTriplet): ChatMsg[] {
  switch (type) {
    case PROMPT_PROCESSING_TYPE.MERGE:
      return mergeMessages(messages, names, { strict: false, semi: false, single: false, tools: false, useExamplePrefixes: false });
    case PROMPT_PROCESSING_TYPE.SEMI:
      return mergeMessages(messages, names, { semi: true, useExamplePrefixes: true });
    case PROMPT_PROCESSING_TYPE.STRICT:
      return mergeMessages(messages, names, { strict: true, useExamplePrefixes: true });
    case PROMPT_PROCESSING_TYPE.SINGLE:
      return mergeMessages(messages, names, { single: true });
    case PROMPT_PROCESSING_TYPE.TOOLS:
      return mergeMessages(messages, names, { tools: true, useExamplePrefixes: true });
    default:
      return messages;
  }
}

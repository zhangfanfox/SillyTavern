export const PROMPT_PROCESSING_TYPE = {
  NONE: '',
  MERGE: 'merge',
  SEMI: 'semi',
  STRICT: 'strict',
  SINGLE: 'single',
} as const;

export type RoleNameTriplet = {
  charName?: string;
  userName?: string;
  groupNames?: string[];
  startsWithGroupName?: (s: string) => boolean;
};

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string | Array<{ type: string; text?: string }> };

export function mergeMessages(messages: ChatMsg[], names: RoleNameTriplet, { strict = false }: { strict?: boolean } = {}): ChatMsg[] {
  const out: ChatMsg[] = [];
  const toText = (m: ChatMsg) => (Array.isArray(m.content) ? m.content.map((c) => (c.type === 'text' ? c.text : '')).filter(Boolean).join('\n\n') : m.content ?? '');
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
  if (strict) {
    for (let i = 1; i < out.length; i++) if (out[i].role === 'system') out[i].role = 'user';
    if (out.length === 0) out.push({ role: 'user', content: "Let's get started." });
  }
  return out;
}

export function postProcessPrompt(messages: ChatMsg[], type: (typeof PROMPT_PROCESSING_TYPE)[keyof typeof PROMPT_PROCESSING_TYPE], names: RoleNameTriplet): ChatMsg[] {
  switch (type) {
    case PROMPT_PROCESSING_TYPE.MERGE:
    case PROMPT_PROCESSING_TYPE.SEMI:
    case PROMPT_PROCESSING_TYPE.STRICT:
    case PROMPT_PROCESSING_TYPE.SINGLE:
      return mergeMessages(messages, names, { strict: type !== PROMPT_PROCESSING_TYPE.MERGE });
    default:
      return messages;
  }
}

// SillyTavern-compatible JSONL serialization helpers for mobile
// Mirrors server/src/endpoints/chats.js format: first line is header with
// { user_name, character_name, create_date, chat_metadata }, then message lines
// Each message typically has: { name, is_user, is_system, send_date, mes, extra }

export type STMessage = {
  name: string;
  is_user: boolean;
  is_system?: boolean;
  send_date: number | string;
  mes: string;
  extra?: Record<string, any>;
};

export type STChatHeader = {
  user_name: string;
  character_name: string;
  create_date: string;
  chat_metadata: Record<string, any> & { integrity?: string };
};

export type STChat = {
  header: STChatHeader;
  messages: STMessage[];
};

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }

export function humanizedISO8601DateTime(d = new Date()): string {
  // Close enough to server util's humanizedISO8601DateTime()
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

export function uuidv4(): string {
  // RFC4122 v4 – use crypto if available, fallback to Math.random
  const cryptoObj: any = (globalThis as any).crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
    return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
  }
  // naive fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function createEmptySTChat(userName: string, characterName: string): STChat {
  const header: STChatHeader = {
    user_name: userName,
    character_name: characterName,
    create_date: humanizedISO8601DateTime(),
    chat_metadata: { integrity: uuidv4() },
  };
  return { header, messages: [] };
}

export function serializeToJSONL(chat: STChat): string {
  const lines: string[] = [];
  lines.push(JSON.stringify(chat.header));
  for (const m of chat.messages) {
    lines.push(JSON.stringify(m));
  }
  return lines.join('\n');
}

export function parseFromJSONL(text: string): STChat | null {
  if (!text) return null;
  const lines = text.split('\n').filter(Boolean);
  if (!lines.length) return null;
  try {
    const header = JSON.parse(lines[0]) as STChatHeader;
    const messages: STMessage[] = [];
    for (let i = 1; i < lines.length; i++) {
      try { messages.push(JSON.parse(lines[i]) as STMessage); } catch { /* skip */ }
    }
    return { header, messages };
  } catch {
    return null;
  }
}

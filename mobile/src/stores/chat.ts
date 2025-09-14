import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { createEmptySTChat, humanizedISO8601DateTime, parseFromJSONL, serializeToJSONL, STMessage } from '../services/chat-serialization';

// We persist sessions to JSONL files under Expo's document directory for compatibility.
// File path: <documents>/st-mobile/chats/<sessionId>.jsonl

const ROOT_DIR = FileSystem.documentDirectory + 'st-mobile/';
const CHATS_DIR = ROOT_DIR + 'chats/';

async function ensureDirs() {
  try { await FileSystem.makeDirectoryAsync(CHATS_DIR, { intermediates: true }); } catch {}
}

export type Session = {
  id: string;                // session id == file name without extension for mobile
  title: string;             // e.g., `${characterName} - ${date}`
  userName: string;          // name1
  characterName: string;     // name2
  avatar?: string;           // future: png path/uri
  createdAt: string;         // ISO-ish
  filePath: string;          // absolute file path for JSONL
  integrity: string;         // header.chat_metadata.integrity
  messages: STMessage[];     // in-memory messages
};

type StreamState = {
  streaming: boolean;
  abortController?: AbortController | null;
};

type ChatState = {
  sessions: Session[];
  currentId?: string;
  stream: StreamState;
  // actions
  createSession: (userName: string, characterName: string, title?: string) => Promise<Session>;
  createSessionFromRole: (role: { name: string; avatar?: string; system_prompt?: string; first_message?: string; description?: string; personality?: string }, userName?: string) => Promise<Session>;
  loadSession: (id: string) => Promise<Session | null>;
  addMessage: (id: string, msg: STMessage) => Promise<void>;
  patchMessage: (id: string, index: number, patch: Partial<STMessage>) => void;
  appendToMessage: (id: string, index: number, text: string) => void;
  setAbortController: (c: AbortController | null) => void;
  setStreaming: (v: boolean) => void;
  exportSessionJSONL: (id: string) => Promise<string | null>;
  loadAllSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
};

async function saveSessionToDisk(s: Session) {
  await ensureDirs();
  const header = createEmptySTChat(s.userName, s.characterName).header;
  header.create_date = s.createdAt || humanizedISO8601DateTime();
  header.chat_metadata.integrity = s.integrity;
  const jsonl = serializeToJSONL({ header, messages: s.messages });
  await FileSystem.writeAsStringAsync(s.filePath, jsonl, { encoding: FileSystem.EncodingType.UTF8 });
}

async function loadSessionFromDisk(filePath: string): Promise<{ header: any; messages: STMessage[] } | null> {
  try {
    const data = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.UTF8 });
    const parsed = parseFromJSONL(data);
    if (!parsed) return null;
    return { header: parsed.header, messages: parsed.messages };
  } catch { return null; }
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentId: undefined,
      stream: { streaming: false, abortController: null },
      createSession: async (userName, characterName, title) => {
        const id = `${characterName} - ${humanizedISO8601DateTime()}`;
        const filePath = `${CHATS_DIR}${encodeURIComponent(id)}.jsonl`;
        const integrity = createEmptySTChat(userName, characterName).header.chat_metadata.integrity || '';
        const sessionTitle = title || `和${characterName}的聊天`;
        const session: Session = { id, title: sessionTitle, userName, characterName, createdAt: humanizedISO8601DateTime(), filePath, integrity, messages: [] };
        try { console.log('[Chat] createSession', { userName, characterName, id, title: sessionTitle }); } catch {}
        set((s) => ({ sessions: [session, ...s.sessions].slice(0, 5), currentId: id }));
        await saveSessionToDisk(session);
        return session;
      },
      createSessionFromRole: async (role, userName = 'User') => {
        const characterName = role.name || 'Assistant';
        const id = `${characterName} - ${humanizedISO8601DateTime()}`;
        const filePath = `${CHATS_DIR}${encodeURIComponent(id)}.jsonl`;
        const integrity = createEmptySTChat(userName, characterName).header.chat_metadata.integrity || '';
        const title = `和${characterName}的聊天`;
  const session: Session = { id, title, userName, characterName, avatar: role.avatar, createdAt: humanizedISO8601DateTime(), filePath, integrity, messages: [] } as Session;
        // Inject system prompt: combine system_prompt with description/personality to give the model enough context
        const sysParts: string[] = [];
        const sys = (role.system_prompt || '').trim();
        if (sys) sysParts.push(sys);
        const desc = (role as any).description?.trim?.() || '';
        const pers = (role as any).personality?.trim?.() || '';
        const behavior = `Stay in character and speak in first person as ${characterName}.`;
        const intro = `You are ${characterName}.`;
        const summary = [intro, desc || undefined, pers ? `Personality: ${pers}` : undefined, behavior].filter(Boolean).join(' ');
        if (!sys || desc || pers) sysParts.push(summary);
        const combinedSys = sysParts.filter(Boolean).join('\n\n').trim();
        if (combinedSys) {
          const sysMsg: STMessage = { name: 'System', is_user: false, is_system: true, send_date: Date.now(), mes: combinedSys } as STMessage;
          session.messages = [sysMsg];
        }
        // Inject first assistant message if provided (SillyTavern: first_mes)
        const first = (role as any).first_message?.trim?.() || '';
        if (first) {
          session.messages = [...session.messages, { name: 'Assistant', is_user: false, send_date: Date.now(), mes: first } as STMessage];
        }
        try {
          console.log('[Chat] createSessionFromRole', { characterName, title, hasSystemPrompt: !!sys, sysLen: sys.length });
        } catch {}
        set((s) => ({ sessions: [session, ...s.sessions].slice(0, 5), currentId: id }));
        await saveSessionToDisk(session);
        return session;
      },
      loadSession: async (id) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return null;
        const loaded = await loadSessionFromDisk(session.filePath);
        if (loaded) {
          session.messages = loaded.messages;
          set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...session } : x)), currentId: id }));
        }
        return session;
      },
      addMessage: async (id, msg) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return;
        session.messages = [...session.messages, msg];
        set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...session } : x)) }));
        await saveSessionToDisk(session);
      },
      patchMessage: (id, index, patch) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return;
        const m = session.messages[index];
        if (!m) return;
        const nextMessages = session.messages.map((mm, i) => (i === index ? { ...m, ...patch } : mm));
        const nextSession = { ...session, messages: nextMessages } as Session;
        set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? nextSession : x)) }));
        // Saving throttled outside (chat UI can call a debounced save)
      },
      appendToMessage: (id, index, text) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return;
        const m = session.messages[index];
        if (!m) return;
        const nextMessages = session.messages.map((mm, i) => (i === index ? { ...m, mes: (m.mes || '') + text } : mm));
        const nextSession = { ...session, messages: nextMessages } as Session;
        set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? nextSession : x)) }));
      },
      setAbortController: (c) => set((state) => ({ stream: { ...state.stream, abortController: c } })),
      setStreaming: (v) => set((state) => ({ stream: { ...state.stream, streaming: v } })),
      exportSessionJSONL: async (id) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return null;
        const header = createEmptySTChat(session.userName, session.characterName).header;
        header.create_date = session.createdAt || humanizedISO8601DateTime();
        header.chat_metadata.integrity = session.integrity;
        return serializeToJSONL({ header, messages: session.messages });
      },
      loadAllSessions: async () => {
        await ensureDirs();
        try {
          const dir = await FileSystem.readDirectoryAsync(CHATS_DIR);
          const ids = dir.filter((f) => f.endsWith('.jsonl')).map((f) => decodeURIComponent(f.replace(/\.jsonl$/i, '')));
          const next: Session[] = [];
          for (const id of ids) {
            const filePath = `${CHATS_DIR}${encodeURIComponent(id)}.jsonl`;
            const loaded = await loadSessionFromDisk(filePath);
            if (loaded) {
              const header: any = loaded.header || {};
              const s: Session = {
                id,
                title: id,
                userName: header.user_name || 'User',
                characterName: header.character_name || 'Assistant',
                createdAt: header.create_date || humanizedISO8601DateTime(),
                filePath,
                integrity: header.chat_metadata?.integrity || '',
                messages: loaded.messages,
              };
              next.push(s);
            }
          }
          // Sort by createdAt/file mtime could be used, but keep as-is
          set({ sessions: next, currentId: next[0]?.id });
        } catch {
          // ignore
        }
      },
      deleteSession: async (id: string) => {
        const s = get().sessions.find((x) => x.id === id);
        if (s) {
          try { await FileSystem.deleteAsync(s.filePath, { idempotent: true }); } catch {}
        }
        const rest = get().sessions.filter((x) => x.id !== id);
        const nextId = get().currentId === id ? rest[0]?.id : get().currentId;
        set({ sessions: rest, currentId: nextId });
      },
    }),
    {
      name: 'chat-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ sessions: state.sessions, currentId: state.currentId }),
    },
  ),
);

let saveTimer: any;
export async function scheduleSaveCurrent(delayMs = 600) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const st = useChatStore.getState();
    const id = st.currentId;
    if (!id) return;
    const session = st.sessions.find((s) => s.id === id);
    if (!session) return;
    await saveSessionToDisk(session);
  }, delayMs);
}

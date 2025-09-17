import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { parseRoleFromJSON as parseGenericJSON, parseRoleFromURL, ImportedRole, ImportProgress } from '../services/role-importers';
import { computeShortName } from '../utils/text';

const ROOT_DIR = FileSystem.documentDirectory + 'st-mobile/';
const ROLES_DIR = ROOT_DIR + 'roles/';
const AVATARS_DIR = ROOT_DIR + 'avatars/';

async function ensureDirs() {
  try { await FileSystem.makeDirectoryAsync(ROLES_DIR, { intermediates: true }); } catch {}
  try { await FileSystem.makeDirectoryAsync(AVATARS_DIR, { intermediates: true }); } catch {}
}

export type STRole = {
  id: string; // file name without extension (encoded)
  name: string;
  avatar?: string; // reserved for future use
  description?: string;
  personality?: string;
  system_prompt?: string;
  first_message?: string;
  short_name?: string;
  creator_notes?: string;
  summary?: string;
  scenario?: string;
  depth?: number;
  speak_frequency?: number;
  tags?: string[];
  extra?: Record<string, any>;
  raw?: any; // original imported JSON for compatibility
  filePath: string;
  createdAt: string;
};

type RoleState = {
  roles: STRole[];
  currentId?: string; // selected role
  loadAllRoles: () => Promise<void>;
  createRole: (r: Omit<STRole, 'id' | 'filePath' | 'createdAt'>) => Promise<STRole>;
  updateRole: (id: string, patch: Partial<STRole>) => Promise<STRole | null>;
  deleteRole: (id: string) => Promise<void>;
  importRoleFromJSON: (text: string) => Promise<STRole>;
  importRoleFromURL: (url: string, opts?: { signal?: AbortSignal; onProgress?: ImportProgress }) => Promise<STRole>;
};

function nowIso() {
  const d = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function guessExtFromMime(mime?: string): string {
  if (!mime) return '.png';
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('webp')) return '.webp';
  return '.png';
}

async function writeAvatarFromArrayBuffer(name: string, buf: ArrayBuffer, mime?: string): Promise<string> {
  await ensureDirs();
  const safe = sanitizeFileName(name);
  const ext = guessExtFromMime(mime);
  const filePath = `${AVATARS_DIR}${safe}-${Date.now()}${ext}`;
  const b64 = Buffer.from(new Uint8Array(buf)).toString('base64');
  await FileSystem.writeAsStringAsync(filePath, b64, { encoding: FileSystem.EncodingType.Base64 });
  return filePath;
}

async function fetchArrayBuffer(url: string, init?: any): Promise<{ buf: ArrayBuffer; mime?: string }> {
  const res = await (globalThis.fetch as any)(url, init);
  if (!res.ok) throw new Error(`下载头像失败 HTTP ${res.status}`);
  const mime = (typeof res.headers?.get === 'function') ? (res.headers.get('content-type') || undefined) : undefined;
  const buf = await res.arrayBuffer();
  return { buf, mime };
}

function sanitizeFileName(name: string) {
  return encodeURIComponent(name.replace(/[\\/:*?"<>|]/g, '_'));
}

async function saveRoleToDisk(role: STRole) {
  await ensureDirs();
  const minimal = {
    name: role.name,
    avatar: role.avatar ?? null,
    description: role.description ?? '',
    personality: role.personality ?? '',
    system_prompt: role.system_prompt ?? '',
    first_message: role.first_message ?? '',
    short_name: role.short_name ?? '',
    creator_notes: role.creator_notes ?? '',
    summary: role.summary ?? '',
    scenario: role.scenario ?? '',
    depth: role.depth ?? null,
    speak_frequency: role.speak_frequency ?? null,
    tags: role.tags ?? null,
    extra: role.extra ?? null,
    raw: role.raw ?? null,
    createdAt: role.createdAt,
  };
  await FileSystem.writeAsStringAsync(role.filePath, JSON.stringify(minimal, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
}

async function loadRoleFromDisk(filePath: string): Promise<STRole | null> {
  try {
    const text = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.UTF8 });
    const json = JSON.parse(text);
    const name: string = json.name ?? 'Unknown';
    const id = decodeURIComponent(filePath.split('/').pop()!.replace(/\.json$/i, ''));
    const r: STRole = {
      id,
      name,
      avatar: json.avatar ?? undefined,
      description: json.description ?? undefined,
      personality: json.personality ?? undefined,
      system_prompt: json.system_prompt ?? undefined,
      first_message: json.first_message ?? json.first_mes ?? undefined,
      short_name: json.short_name ?? undefined,
      creator_notes: json.creator_notes ?? undefined,
      summary: json.summary ?? undefined,
      scenario: json.scenario ?? undefined,
      depth: typeof json.depth === 'number' ? json.depth : undefined,
      speak_frequency: typeof json.speak_frequency === 'number' ? json.speak_frequency : undefined,
      tags: Array.isArray(json.tags) ? json.tags : undefined,
      extra: json.extra ?? undefined,
      raw: json.raw ?? undefined,
      filePath,
      createdAt: json.createdAt ?? nowIso(),
    } as STRole;
    // Ensure short_name
    if (!r.short_name && r.name) {
      r.short_name = computeShortName(r.name);
      try { await FileSystem.writeAsStringAsync(filePath, JSON.stringify({ ...json, short_name: r.short_name }, null, 2), { encoding: FileSystem.EncodingType.UTF8 }); } catch {}
    }
    return r;
  } catch {
    return null;
  }
}

export function parseSillyTavernRoleCard(text: string): { name: string; avatar?: string; description?: string; system_prompt?: string; raw: any } {
  // Tolerant parser for ST character cards (v2/v3) and simple JSON
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error('Invalid JSON'); }
  // v3: spec == 'chara_card_v3', data carries fields
  if ((json.spec && String(json.spec).toLowerCase().includes('chara_card_v3')) || json.data) {
  const d = json.data ?? json;
  const ext = d.extensions?.sillytavern ?? d.extensions?.sillytavern;
    return {
      name: d.name ?? 'Unknown',
      avatar: d.avatar ?? ext?.avatar ?? undefined,
      description: d.description ?? ext?.description ?? '',
      system_prompt: d.system_prompt ?? ext?.system_prompt ?? '',
      raw: json,
    };
  }
  // v2 or plain: keys directly on root
  return {
    name: json.name ?? 'Unknown',
    avatar: json.avatar,
    description: json.description ?? json.personality ?? json.scenario ?? '',
    system_prompt: json.system_prompt ?? '',
    raw: json,
  };
}

export const useRolesStore = create<RoleState>()(
  persist(
    (set, get) => ({
      roles: [],
      currentId: undefined,
      loadAllRoles: async () => {
        await ensureDirs();
        try {
          const dir = await FileSystem.readDirectoryAsync(ROLES_DIR);
          const ids = dir.filter((f) => f.endsWith('.json')).map((f) => decodeURIComponent(f.replace(/\.json$/i, '')));
          const list: STRole[] = [];
          for (const id of ids) {
            const fp = `${ROLES_DIR}${sanitizeFileName(id)}.json`;
            const r = await loadRoleFromDisk(fp);
            if (r) list.push(r);
          }
          set({ roles: list, currentId: list[0]?.id });
        } catch {}
      },
      createRole: async (rInit) => {
        const id = rInit.name || `角色-${Date.now()}`;
        const safe = sanitizeFileName(id);
        const filePath = `${ROLES_DIR}${safe}.json`;
        const role: STRole = { id, filePath, createdAt: nowIso(), short_name: rInit.short_name || computeShortName(rInit.name), ...rInit } as STRole;
        await saveRoleToDisk(role);
        set((s) => ({ roles: [role, ...s.roles], currentId: role.id }));
        return role;
      },
      updateRole: async (id, patch) => {
        const role = get().roles.find((r) => r.id === id);
        if (!role) return null;
        const next: STRole = { ...role, ...patch } as STRole;
        await saveRoleToDisk(next);
        set((s) => ({ roles: s.roles.map((r) => (r.id === id ? next : r)), currentId: id }));
        return next;
      },
      deleteRole: async (id) => {
        const role = get().roles.find((r) => r.id === id);
        if (role) {
          try { await FileSystem.deleteAsync(role.filePath, { idempotent: true }); } catch {}
        }
        const rest = get().roles.filter((r) => r.id !== id);
        set({ roles: rest, currentId: rest[0]?.id });
      },
      importRoleFromJSON: async (text) => {
        console.info('[roles.store] importRoleFromJSON start');
        const p: ImportedRole = parseGenericJSON(text);
        if (!p?.name && !p?.description) {
          console.error('[roles.store] Parsed empty role from JSON');
          throw new Error('解析失败：未找到角色信息');
        }
        const role = await get().createRole({
          name: p.name,
          avatar: p.avatar,
          description: p.description,
          personality: p.personality,
          system_prompt: p.system_prompt,
          first_message: p.first_message,
          short_name: computeShortName(p.name),
          creator_notes: p.creator_notes,
          summary: p.summary,
          scenario: p.scenario,
          depth: p.depth,
          speak_frequency: p.speak_frequency,
          tags: p.tags,
          extra: p.extra,
          raw: p.raw,
        } as Omit<STRole, 'id' | 'filePath' | 'createdAt'>);
        console.info('[roles.store] importRoleFromJSON success ->', role.name);
        return role;
      },
      importRoleFromURL: async (url, opts) => {
        console.info('[roles.store] importRoleFromURL start', url);
        const p = await parseRoleFromURL(url, { signal: opts?.signal, onProgress: opts?.onProgress });
        if (!p?.name && !p?.description) {
          console.error('[roles.store] Parsed empty role from URL');
          throw new Error('解析失败：未找到角色信息');
        }
        // Save avatar locally if available
        let avatarUri: string | undefined = undefined;
        try {
          if (p.avatarBinary) {
            opts?.onProgress?.('保存头像');
            avatarUri = await writeAvatarFromArrayBuffer(p.name || 'avatar', p.avatarBinary, p.avatarMime);
          } else if (p.avatar && /^https?:\/\//i.test(p.avatar)) {
            opts?.onProgress?.('下载头像');
            const { buf, mime } = await fetchArrayBuffer(p.avatar, { signal: opts?.signal });
            avatarUri = await writeAvatarFromArrayBuffer(p.name || 'avatar', buf, mime);
          } else if (p.avatar && p.avatar.startsWith('file://')) {
            avatarUri = p.avatar;
          }
        } catch (e) {
          console.warn('[roles.store] 保存头像失败，忽略', e);
        }
        const role = await get().createRole({
          name: p.name,
          avatar: avatarUri || p.avatar,
          description: p.description,
          personality: p.personality,
          system_prompt: p.system_prompt,
          first_message: p.first_message,
          short_name: computeShortName(p.name),
          creator_notes: p.creator_notes,
          summary: p.summary,
          scenario: p.scenario,
          depth: p.depth,
          speak_frequency: p.speak_frequency,
          tags: p.tags,
          extra: p.extra,
          raw: p.raw,
        } as Omit<STRole, 'id' | 'filePath' | 'createdAt'>);
        console.info('[roles.store] importRoleFromURL success ->', role.name);
        return role;
      },
    }),
    {
      name: 'roles-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ roles: s.roles, currentId: s.currentId }),
    },
  ),
);

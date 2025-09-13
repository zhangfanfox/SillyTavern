import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const ROOT_DIR = FileSystem.documentDirectory + 'st-mobile/';
const ROLES_DIR = ROOT_DIR + 'roles/';

async function ensureDirs() {
  try { await FileSystem.makeDirectoryAsync(ROLES_DIR, { intermediates: true }); } catch {}
}

export type STRole = {
  id: string; // file name without extension (encoded)
  name: string;
  avatar?: string; // reserved for future use
  description?: string;
  system_prompt?: string;
  raw?: any; // original imported JSON for compatibility
  filePath: string;
  createdAt: string;
};

type RoleState = {
  roles: STRole[];
  currentId?: string; // selected role
  loadAllRoles: () => Promise<void>;
  createRole: (r: Omit<STRole, 'id' | 'filePath' | 'createdAt'>) => Promise<STRole>;
  deleteRole: (id: string) => Promise<void>;
  importRoleFromJSON: (text: string) => Promise<STRole>;
  importRoleFromURL: (url: string) => Promise<STRole>;
};

function nowIso() {
  const d = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
    system_prompt: role.system_prompt ?? '',
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
    return {
      id,
      name,
      avatar: json.avatar ?? undefined,
      description: json.description ?? undefined,
      system_prompt: json.system_prompt ?? undefined,
      raw: json.raw ?? undefined,
      filePath,
      createdAt: json.createdAt ?? nowIso(),
    } as STRole;
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
        const role: STRole = { id, filePath, createdAt: nowIso(), ...rInit } as STRole;
        await saveRoleToDisk(role);
        set((s) => ({ roles: [role, ...s.roles], currentId: role.id }));
        return role;
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
        const parsed = parseSillyTavernRoleCard(text);
  const role = await get().createRole({ name: parsed.name, avatar: parsed.avatar, description: parsed.description, system_prompt: parsed.system_prompt, raw: parsed.raw } as Omit<STRole, 'id' | 'filePath' | 'createdAt'>);
        return role;
      },
      importRoleFromURL: async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return get().importRoleFromJSON(text);
      },
    }),
    {
      name: 'roles-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ roles: s.roles, currentId: s.currentId }),
    },
  ),
);

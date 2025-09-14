import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSecret, getSecret, deleteSecret } from '../services/secure';

export type ProviderId = 'openai' | 'gemini' | 'claude' | 'openrouter';

export interface ApiConnectionMeta {
  id: string; // uuid
  name: string;
  provider: ProviderId;
  baseUrl?: string;
  model?: string;
  isDefault?: boolean;
  isValid?: boolean;
  preferStream?: boolean; // whether to use streaming when available
}

export interface ApiConnectionWithSecret extends ApiConnectionMeta {
  apiKey?: string; // only in memory when editing
}

interface ConnectionsState {
  items: ApiConnectionMeta[];
  currentId?: string;
  add: (c: ApiConnectionWithSecret) => Promise<void>;
  update: (id: string, patch: Partial<ApiConnectionWithSecret>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setDefault: (id: string) => void;
  setCurrent: (id: string) => void;
  getSecretKey: (id: string) => Promise<string | null>;
  setValidity: (id: string, valid: boolean) => void;
}

const SECRET_PREFIX = 'conn_secret_';

export const useConnectionsStore = create<ConnectionsState>()(
  persist(
    (set) => ({
      items: [],
      currentId: undefined,
      add: async (c) => {
        if (c.apiKey) await setSecret(SECRET_PREFIX + c.id, c.apiKey);
        const meta: ApiConnectionMeta = {
          id: c.id,
          name: c.name,
          provider: c.provider,
          baseUrl: c.baseUrl,
          model: c.model,
          isDefault: c.isDefault ?? false,
          isValid: undefined,
          preferStream: true,
        };
        set((s) => {
          const items = [...s.items, meta];
          const currentId = s.currentId || meta.id; // select first added by default if none
          return { items, currentId };
        });
      },
      update: async (id, patch) => {
        if (patch.apiKey !== undefined) {
          if (patch.apiKey) await setSecret(SECRET_PREFIX + id, patch.apiKey);
          else await deleteSecret(SECRET_PREFIX + id);
        }
        set((s) => ({
          items: s.items.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        }));
      },
      remove: async (id) => {
        await deleteSecret(SECRET_PREFIX + id);
        set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
      },
      setDefault: (id) => {
        set((s) => ({
          items: s.items.map((x) => ({ ...x, isDefault: x.id === id })),
          currentId: id,
        }));
      },
      setCurrent: (id) => set(() => ({ currentId: id })),
      getSecretKey: async (id) => getSecret(SECRET_PREFIX + id),
      setValidity: (id, valid) => set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, isValid: valid } : x)) })),
    }),
    {
      name: 'connections-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items, currentId: state.currentId }),
    }
  )
);

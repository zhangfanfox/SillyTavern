import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ParamsState {
  byConnId: Record<string, Record<string, any>>;
  get: (connectionId: string) => Record<string, any> | undefined;
  set: (connectionId: string, params: Record<string, any>) => void;
  merge: (connectionId: string, patch: Record<string, any>) => void;
  clear: (connectionId: string) => void;
}

export const useParamsStore = create<ParamsState>()(
  persist(
    (set, get) => ({
      byConnId: {},
      get: (id) => get().byConnId[id],
      set: (id, params) => set((s) => ({ byConnId: { ...s.byConnId, [id]: { ...params } } })),
      merge: (id, patch) => set((s) => ({ byConnId: { ...s.byConnId, [id]: { ...(s.byConnId[id] ?? {}), ...patch } } })),
      clear: (id) => set((s) => {
        const copy = { ...s.byConnId };
        delete copy[id];
        return { byConnId: copy };
      }),
    }),
    {
      name: 'params-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byConnId: state.byConnId }),
    }
  )
);

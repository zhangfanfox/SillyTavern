import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UIState {
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      rightPanelOpen: false,
      setRightPanelOpen: (open) => set({ rightPanelOpen: open })
    }),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);

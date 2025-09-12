import { useColorScheme } from 'react-native';
import { MD3DarkTheme as PaperDarkTheme, MD3LightTheme as PaperLightTheme } from 'react-native-paper';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode })
    }),
    { name: 'theme-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);

export function useThemeProvider() {
  const scheme = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
  const paperTheme = isDark ? PaperDarkTheme : PaperLightTheme;
  return { isDark, paperTheme };
}

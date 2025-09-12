import '../src/polyfills';
import { Slot } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { Platform, LogBox } from 'react-native';

export default function RootLayout() {
  useEffect(() => {
    // RN Reanimated/gesture handler noisy warnings in dev
    LogBox.ignoreLogs([
      'Sending `onAnimatedValueUpdate` with no listeners registered'
    ]);
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <Slot />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

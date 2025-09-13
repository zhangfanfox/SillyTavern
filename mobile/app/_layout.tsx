import 'react-native-gesture-handler';
import 'react-native-reanimated';
import '../src/polyfills';
import { Drawer } from 'expo-router/drawer';
import { Slot, useNavigation } from 'expo-router';
import { IconButton, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import RightParamsDrawer from '../components/RightParamsDrawer';
import { useUIStore } from '../src/stores/ui';
import { useThemeProvider } from '../src/theme';

export default function RootLayout() {
  useEffect(() => {
    // RN Reanimated/gesture handler noisy warnings in dev
    LogBox.ignoreLogs([
      'Sending `onAnimatedValueUpdate` with no listeners registered'
    ]);
  }, []);

  const ui = useUIStore();
  const { paperTheme } = useThemeProvider();

  const HeaderMenuButton = () => {
    const navigation = useNavigation();
    return (
      <IconButton
        icon="menu"
        onPress={() => {
          // @ts-expect-error Drawer API available at runtime
          navigation.toggleDrawer?.();
        }}
        accessibilityLabel="Open navigation"
      />
    );
  };

  const HeaderParamsButton = () => (
    <IconButton
      icon="tune"
      onPress={() => ui.setRightPanelOpen(true)}
      accessibilityLabel="Open parameters"
    />
  );

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <View style={{ flex: 1 }}>
          {/* Left navigation drawer via expo-router */}
          <Drawer screenOptions={{ headerLeft: HeaderMenuButton, headerRight: HeaderParamsButton }}>
            {/* Declare key routes to appear in left drawer */}
            <Drawer.Screen name="index" options={{ title: '主页' }} />
            <Drawer.Screen name="chat/index" options={{ title: '聊天' }} />
            <Drawer.Screen name="roles/index" options={{ title: '角色' }} />
            <Drawer.Screen name="roles/create" options={{ title: '新建角色' }} />
            <Drawer.Screen name="connections/index" options={{ title: 'API 连接' }} />
          </Drawer>

          {/* Right side parameters panel overlay */}
          <RightParamsDrawer />
        </View>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

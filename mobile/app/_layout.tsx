import 'react-native-gesture-handler';
import '../src/polyfills';
import 'react-native-reanimated';
import { Drawer } from 'expo-router/drawer';
import { useNavigation } from 'expo-router';
import { IconButton, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import RightParamsDrawer from '../components/RightParamsDrawer';
import LeftDrawerContent from '../components/LeftDrawerContent';
import { useUIStore } from '../src/stores/ui';
import { useThemeProvider } from '../src/theme';

function HeaderMenuButton() {
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
}

function HeaderParamsButton() {
  const ui = useUIStore();
  return (
    <IconButton
      icon="tune"
      onPress={() => ui.setRightPanelOpen(true)}
      accessibilityLabel="Open parameters"
    />
  );
}

export default function RootLayout() {
  useEffect(() => {
    // RN Reanimated/gesture handler noisy warnings in dev
    LogBox.ignoreLogs([
      'Sending `onAnimatedValueUpdate` with no listeners registered',
      'Cannot read property \'level\' of undefined',
      'Route "./_layout.tsx" is missing the required default export',
    ]);
  }, []);

  const { paperTheme } = useThemeProvider();

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
  <View style={styles.flex1}>
          {/* Left navigation drawer via expo-router */}
          <Drawer
            screenOptions={{ headerLeft: HeaderMenuButton, headerRight: HeaderParamsButton }}
            drawerContent={LeftDrawerContent}
          >
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

const styles = StyleSheet.create({
  flex1: { flex: 1 },
});

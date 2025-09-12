import { Link } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useThemeStore } from '../src/theme';

export default function Home() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SillyTavern Mobile</Text>
      <Text style={styles.subtitle}>RN + Expo 初始化完成</Text>
      <Link href="/chat" style={styles.link}>前往聊天</Link>
      <Link href="/roles" style={styles.link}>前往角色</Link>
      <Link href="/connections" style={styles.link}>前往 API 连接</Link>
      <View style={{ height: 16 }} />
      <Text>主题模式：{mode}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button compact onPress={() => setMode('system')}>System</Button>
        <Button compact onPress={() => setMode('light')}>Light</Button>
        <Button compact onPress={() => setMode('dark')}>Dark</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#666' },
  link: { color: '#6c5ce7', textDecorationLine: 'underline' }
});

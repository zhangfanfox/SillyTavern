import { Link } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SillyTavern Mobile</Text>
      <Text style={styles.subtitle}>RN + Expo 初始化完成</Text>
      <Link href="/roles" style={styles.link}>前往角色</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#666' },
  link: { color: '#6c5ce7', textDecorationLine: 'underline' }
});

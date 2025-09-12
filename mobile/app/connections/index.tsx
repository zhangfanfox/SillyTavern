import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function ConnectionsScreen() {
  return (
    <View style={styles.container}>
      <Text variant="titleLarge">API 连接</Text>
      <Text>配置 OpenAI/Gemini/Claude 等提供商（M2 完成 CRUD）。</Text>
      <Button mode="contained" disabled>
        新建连接（M2 实现）
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 }
});

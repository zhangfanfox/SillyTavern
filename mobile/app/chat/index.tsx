import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function ChatScreen() {
  return (
    <View style={styles.container}>
      <Text variant="titleLarge">聊天</Text>
      <Text>这里将展示消息列表与输入框（M3 实现）。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 }
});

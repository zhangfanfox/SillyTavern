import { View, StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

export default function RoleCreateScreen() {
  return (
    <View style={styles.container}>
      <Text variant="titleLarge">新建角色</Text>
      <TextInput label="名称" mode="outlined" value="" placeholder="如：Seraphina" />
      <TextInput label="系统提示" mode="outlined" multiline numberOfLines={5} placeholder="系统提示..." />
      <Button mode="contained" disabled>
        保存（M4 实现）
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 }
});

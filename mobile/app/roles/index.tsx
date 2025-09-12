import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Link } from 'expo-router';

export default function RolesScreen() {
  return (
    <View style={styles.container}>
      <Text variant="titleLarge">角色</Text>
      <Text>列出本地角色（M4 实现），可以新建/导入。</Text>
      <Link href="/roles/create" asChild>
        <Button mode="contained">新建角色</Button>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 }
});

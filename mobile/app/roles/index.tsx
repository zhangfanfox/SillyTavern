import { View, StyleSheet } from 'react-native';
import { Button, IconButton, List, Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { useRolesStore } from '../../src/stores/roles';

export default function RolesScreen() {
  const { roles, loadAllRoles, deleteRole } = useRolesStore();
  useEffect(() => { loadAllRoles(); }, [loadAllRoles]);
  return (
    <View style={styles.container}>
      <Text variant="titleLarge">角色</Text>
      <Text>列出本地角色，可以新建/导入。</Text>
      <View style={styles.flex1}>
        {roles.map((r) => (
          <List.Item
            key={r.id}
            title={r.name}
            description={r.description}
            right={() => (
              <View style={styles.rowCenter}>
                <IconButton icon="delete" onPress={() => deleteRole(r.id)} accessibilityLabel="删除角色" />
              </View>
            )}
          />
        ))}
        {roles.length === 0 && <Text style={styles.empty}>暂无角色</Text>}
      </View>
      <Link href="/roles/create" asChild>
        <Button mode="contained">新建角色</Button>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  flex1: { flex: 1 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  empty: { opacity: 0.6 },
});

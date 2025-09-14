import { View, StyleSheet } from 'react-native';
import { Button, IconButton, List, Text } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { useEffect } from 'react';
import { useRolesStore } from '../../src/stores/roles';
import { useChatStore } from '../../src/stores/chat';

function RoleActions({ onStart, onEdit, onDelete }: { onStart: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.rowCenter}>
      <IconButton icon="message-processing-outline" onPress={onStart} accessibilityLabel="开始聊天" />
      <IconButton icon="pencil" onPress={onEdit} accessibilityLabel="编辑角色" />
      <IconButton icon="delete" onPress={onDelete} accessibilityLabel="删除角色" />
    </View>
  );
}

export default function RolesScreen() {
  const { roles, loadAllRoles, deleteRole } = useRolesStore();
  const chat = useChatStore();
  useEffect(() => { loadAllRoles(); }, [loadAllRoles]);
  return (
    <View style={styles.container}>
      <Text variant="titleLarge">角色</Text>
      <Text>列出本地角色，可以新建/导入。</Text>
      <View style={styles.flex1}>
        {roles.map((r) => {
          const onStart = async () => {
            await chat.createSessionFromRole({ name: r.name, avatar: r.avatar, system_prompt: r.system_prompt, first_message: r.first_message });
            router.push('/chat');
          };
          const onDelete = () => deleteRole(r.id);
          const onEdit = () => router.push(`/roles/${encodeURIComponent(r.id)}` as any);
          return (
            <View key={r.id} style={styles.roleItem}>
              <List.Item title={r.name} description={r.description} />
              <RoleActions onStart={onStart} onEdit={onEdit} onDelete={onDelete} />
            </View>
          );
        })}
        {roles.length === 0 && <Text style={styles.empty}>暂无角色</Text>}
      </View>
      <Link href="/roles/create" asChild>
        <Button mode="contained">新建角色</Button>
      </Link>
      <Link href="/roles/import" asChild>
        <Button mode="text">导入角色</Button>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  flex1: { flex: 1 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  empty: { opacity: 0.6 },
  roleItem: { marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

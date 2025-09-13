import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Divider, IconButton, List, Text, Dialog, Portal } from 'react-native-paper';
import { useChatStore } from '../src/stores/chat';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRolesStore } from '../src/stores/roles';

export default function LeftDrawerContent() {
  const { sessions, currentId, loadAllSessions, createSession } = useChatStore();
  const router = useRouter();
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [rolePickerOpen, setRolePickerOpen] = React.useState(false);
  const roles = useRolesStore((s) => s.roles);
  const loadAllRoles = useRolesStore((s) => s.loadAllRoles);

  useEffect(() => {
    // Hydrate sessions for the drawer; if none exist, create default
    (async () => {
      await loadAllSessions();
      const hasAny = useChatStore.getState().sessions.length > 0;
      if (!hasAny) await createSession('User', 'Assistant');
      try { await loadAllRoles(); } catch {}
    })();
  }, [loadAllSessions, createSession, loadAllRoles]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text variant="titleMedium">会话</Text>
        <IconButton
          icon="plus"
          onPress={() => setRolePickerOpen(true)}
          accessibilityLabel="从角色开始会话"
        />
      </View>
  <Divider style={styles.mb8} />

      <View style={styles.list}>
        {sessions.length === 0 ? (
          <Text style={styles.empty}>暂无会话</Text>
        ) : (
          sessions.map((s) => (
            <View key={s.id} style={styles.sessionRow}>
              <View style={styles.sessionMain}>
                <List.Item
                  title={s.title || s.id}
                  description={`${s.characterName}${currentId === s.id ? ' · 当前' : ''}`}
                  onPress={() => {
                    useChatStore.setState({ currentId: s.id });
                    router.push('/chat');
                  }}
                />
              </View>
              <IconButton icon="delete" onPress={() => setConfirmId(s.id)} accessibilityLabel="删除会话" />
            </View>
          ))
        )}
      </View>

  <Divider style={styles.mv8} />

      <View style={styles.bottomButtons}>
        <Link href="/" asChild>
          <Button mode="text">主页</Button>
        </Link>
        <Link href="/connections" asChild>
          <Button mode="text">API 连接</Button>
        </Link>
        <Link href="/roles" asChild>
          <Button mode="text">角色</Button>
        </Link>
      </View>
      <Portal>
        <Dialog visible={!!confirmId} onDismiss={() => setConfirmId(null)}>
          <Dialog.Title>删除会话</Dialog.Title>
          <Dialog.Content>
            <Text>确定要删除该会话吗？此操作不可撤销。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmId(null)}>取消</Button>
            <Button
              onPress={async () => {
                if (confirmId) {
                  await useChatStore.getState().deleteSession(confirmId);
                }
                setConfirmId(null);
              }}
            >
              删除
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={rolePickerOpen} onDismiss={() => setRolePickerOpen(false)}>
          <Dialog.Title>选择角色开始聊天</Dialog.Title>
          <Dialog.Content>
            {roles.length === 0 ? (
              <Text>暂无角色，请先在“角色”页面创建或导入。</Text>
            ) : (
              roles.map((r) => (
                <List.Item
                  key={r.id}
                  title={r.name}
                  description={(r.description || '').slice(0, 60)}
                  onPress={async () => {
                    const session = await useChatStore.getState().createSessionFromRole(r);
                    useChatStore.setState({ currentId: session.id });
                    setRolePickerOpen(false);
                    router.push('/chat');
                  }}
                />
              ))
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRolePickerOpen(false)}>关闭</Button>
            <Link href="/roles" asChild>
              <Button>管理角色</Button>
            </Link>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, padding: 8, paddingTop: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { flex: 1 },
  bottomButtons: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  empty: { opacity: 0.6 },
  mb8: { marginBottom: 8 },
  mv8: { marginVertical: 8 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionMain: { flex: 1 },
});

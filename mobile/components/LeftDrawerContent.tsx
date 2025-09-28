import React, { useEffect } from 'react';
import { View, StyleSheet, Modal as RNModal, ScrollView } from 'react-native';
import { Button, Divider, IconButton, List, Text, Surface, SegmentedButtons } from 'react-native-paper';
import { useChatStore } from '../src/stores/chat';
import { useAVGStore } from '../src/stores/avg';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRolesStore } from '../src/stores/roles';
import { SaveMetadata } from '../src/types/avg';

export default function LeftDrawerContent() {
  const { sessions, currentId, loadAllSessions, createSession } = useChatStore();
  const { listGameSaves, deleteGameSave, getSaveMetadata } = useAVGStore();
  const router = useRouter();
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [rolePickerOpen, setRolePickerOpen] = React.useState(false);
  const [sessionType, setSessionType] = React.useState<'chat' | 'avg'>('chat');
  const [avgSessions, setAvgSessions] = React.useState<SaveMetadata[]>([]);
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

  useEffect(() => {
    // Load AVG sessions when switching to AVG tab
    if (sessionType === 'avg') {
      loadAVGSessions();
    }
  }, [sessionType]);

  const loadAVGSessions = async () => {
    try {
      const saves = await listGameSaves();
      const savesWithMetadata = await Promise.all(
        saves.map(async (sessionId) => {
          const metadata = await getSaveMetadata(sessionId);
          return metadata || {
            sessionId,
            title: `游戏 ${sessionId.slice(-8)}`,
            characterName: '未知角色',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            dialogueCount: 0,
          };
        })
      );
      setAvgSessions(savesWithMetadata);
    } catch (error) {
      console.error('Failed to load AVG sessions:', error);
    }
  };

  const handleDeleteAVGSession = async (sessionId: string) => {
    try {
      const success = await deleteGameSave(sessionId);
      if (success) {
        await loadAVGSessions(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to delete AVG session:', error);
    }
    setConfirmId(null);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '未知时间';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text variant="titleMedium">会话</Text>
          <IconButton
            icon="plus"
            onPress={() => {
              if (sessionType === 'chat') {
                setRolePickerOpen(true);
              } else {
                // Create new AVG session
                const sessionId = `avg-${Date.now()}`;
                router.push(`/avg/game/${sessionId}`);
              }
            }}
            accessibilityLabel={sessionType === 'chat' ? "从角色开始会话" : "开始新AVG游戏"}
          />
        </View>

        <SegmentedButtons
          value={sessionType}
          onValueChange={(value) => setSessionType(value as 'chat' | 'avg')}
          buttons={[
            { value: 'chat', label: '聊天', icon: 'chat' },
            { value: 'avg', label: 'AVG', icon: 'book-open-variant' },
          ]}
          style={styles.segmentedButtons}
        />

        <Divider style={styles.mb8} />

        <ScrollView style={styles.list}>
          {sessionType === 'chat' ? (
            sessions.length === 0 ? (
              <Text style={styles.empty}>暂无聊天会话</Text>
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
            )
          ) : (
            avgSessions.length === 0 ? (
              <Text style={styles.empty}>暂无AVG会话</Text>
            ) : (
              avgSessions.map((save) => (
                <View key={save.sessionId} style={styles.sessionRow}>
                  <View style={styles.sessionMain}>
                    <List.Item
                      title={save.title}
                      description={`${save.characterName} · ${formatDate(save.updatedAt)}`}
                      onPress={() => {
                        router.push(`/avg/game/${save.sessionId}`);
                      }}
                    />
                  </View>
                  <IconButton 
                    icon="delete" 
                    onPress={() => setConfirmId(save.sessionId)} 
                    accessibilityLabel="删除AVG会话" 
                  />
                </View>
              ))
            )
          )}
        </ScrollView>

        <Divider style={styles.mv8} />

        <View style={styles.bottomButtons}>
          <Link href="/" asChild>
            <Button mode="text">主页</Button>
          </Link>
          <Link href="/avg" asChild>
            <Button mode="text" icon="book-open-variant">AVG 故事</Button>
          </Link>
          <Link href="/connections" asChild>
            <Button mode="text">API 连接</Button>
          </Link>
          <Link href="/roles" asChild>
            <Button mode="text">角色</Button>
          </Link>
        </View>

        {/* Confirmation Dialog */}
        <RNModal
          visible={!!confirmId}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmId(null)}
        >
          <View style={styles.overlay}>
            <Surface style={styles.dialog} elevation={4}>
              <Text variant="titleMedium" style={styles.dialogTitle}>
                删除{sessionType === 'chat' ? '聊天' : 'AVG'}会话
              </Text>
              <Text style={styles.dialogContent}>确定要删除该会话吗？此操作不可撤销。</Text>
              <View style={styles.dialogActions}>
                <Button onPress={() => setConfirmId(null)}>取消</Button>
                <Button
                  mode="contained"
                  onPress={async () => {
                    if (confirmId) {
                      if (sessionType === 'chat') {
                        await useChatStore.getState().deleteSession(confirmId);
                      } else {
                        await handleDeleteAVGSession(confirmId);
                      }
                    }
                    setConfirmId(null);
                  }}
                >
                  删除
                </Button>
              </View>
            </Surface>
          </View>
        </RNModal>

        {/* Role Picker Dialog */}
        <RNModal
          visible={rolePickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setRolePickerOpen(false)}
        >
          <View style={styles.overlay}>
            <Surface style={styles.dialog} elevation={4}>
              <Text variant="titleMedium" style={styles.dialogTitle}>选择角色开始聊天</Text>
              <View style={styles.dialogContent}>
                {roles.length === 0 ? (
                  <Text>暂无角色，请先在"角色"页面创建或导入。</Text>
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
              </View>
              <View style={styles.dialogActions}>
                <Button onPress={() => setRolePickerOpen(false)}>关闭</Button>
                <Link href="/roles" asChild>
                  <Button mode="contained">管理角色</Button>
                </Link>
              </View>
            </Surface>
          </View>
        </RNModal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, padding: 8, paddingTop: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segmentedButtons: { marginBottom: 8 },
  list: { flex: 1 },
  bottomButtons: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  empty: { opacity: 0.6, padding: 16, textAlign: 'center' },
  mb8: { marginBottom: 8 },
  mv8: { marginVertical: 8 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionMain: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialog: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    minWidth: 300,
    maxWidth: '90%',
  },
  dialogTitle: { marginBottom: 8 },
  dialogContent: { marginBottom: 16 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});

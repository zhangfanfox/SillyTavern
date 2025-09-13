import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Divider, IconButton, List, Text } from 'react-native-paper';
import { useChatStore } from '../src/stores/chat';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LeftDrawerContent() {
  const { sessions, currentId, loadAllSessions, createSession } = useChatStore();
  const router = useRouter();

  useEffect(() => {
    // Hydrate sessions for the drawer; if none exist, create default
    (async () => {
      await loadAllSessions();
      const hasAny = useChatStore.getState().sessions.length > 0;
      if (!hasAny) await createSession('User', 'Assistant');
    })();
  }, [loadAllSessions, createSession]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text variant="titleMedium">会话</Text>
        <IconButton
          icon="plus"
          onPress={async () => {
            await createSession('User', 'Assistant');
            router.push('/chat');
          }}
          accessibilityLabel="新建会话"
        />
      </View>
  <Divider style={styles.mb8} />

      <View style={styles.list}>
        {sessions.length === 0 ? (
          <Text style={styles.empty}>暂无会话</Text>
        ) : (
          sessions.map((s) => (
              <List.Item
                key={s.id}
                title={s.title || s.id}
                description={`${s.characterName}${currentId === s.id ? ' · 当前' : ''}`}
                onPress={() => {
                  useChatStore.setState({ currentId: s.id });
                  router.push('/chat');
                }}
              />
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
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal as RNModal } from 'react-native';
import { Button, List, IconButton, Surface, Divider, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { useAVGStore } from '../../src/stores/avg';
import { SaveMetadata } from '../../src/types/avg';

export default function AVGIndexScreen() {
  const [savedGames, setSavedGames] = useState<SaveMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { listGameSaves, deleteGameSave, getSaveMetadata } = useAVGStore();

  useEffect(() => {
    loadSavedGames();
  }, []);

  const loadSavedGames = async () => {
    setLoading(true);
    try {
      const saves = await listGameSaves();
      // Get metadata for each save
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
      setSavedGames(savesWithMetadata);
    } catch (error) {
      console.error('Failed to load saved games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewGame = () => {
    // Generate a new session ID and navigate to the game screen
    const sessionId = `avg-${Date.now()}`;
    router.push(`/avg/game/${sessionId}`);
  };

  const handleLoadGame = (sessionId: string) => {
    router.push(`/avg/game/${sessionId}`);
  };

  const handleDeleteGame = async (sessionId: string) => {
    try {
      const success = await deleteGameSave(sessionId);
      if (success) {
        await loadSavedGames(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to delete game:', error);
    }
    setDeleteConfirmId(null);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('zh-CN', {
        year: 'numeric',
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AVG 故事模式</Text>
        <Text style={styles.subtitle}>沉浸式AI故事体验</Text>

        <Button
          mode="contained"
          onPress={handleStartNewGame}
          style={styles.newGameButton}
          icon="plus"
        >
          开始新游戏
        </Button>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.savedGamesSection}>
        <Text style={styles.sectionTitle}>存档列表</Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载存档中...</Text>
          </View>
        ) : savedGames.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无存档</Text>
            <Text style={styles.emptySubtext}>开始新游戏来创建第一个存档</Text>
          </View>
        ) : (
          savedGames.map((save) => (
            <Surface key={save.sessionId} style={styles.saveItem} elevation={1}>
              <View style={styles.saveContent}>
                <List.Item
                  title={save.title}
                  description={`${save.characterName} · ${save.dialogueCount} 条对话`}
                  left={(props) => <List.Icon {...props} icon="book-open-variant" />}
                  right={() => (
                    <View style={styles.saveActions}>
                      <Text style={styles.saveDate}>{formatDate(save.updatedAt)}</Text>
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => setDeleteConfirmId(save.sessionId)}
                      />
                    </View>
                  )}
                  onPress={() => handleLoadGame(save.sessionId)}
                />
              </View>
            </Surface>
          ))
        )}
      </View>

      {/* Delete Confirmation Dialog */}
      <RNModal
        visible={!!deleteConfirmId}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmId(null)}
      >
        <View style={styles.overlay}>
          <Surface style={styles.dialog} elevation={4}>
            <Text style={styles.dialogTitle}>删除存档</Text>
            <Text style={styles.dialogContent}>
              确定要删除这个存档吗？此操作不可撤销。
            </Text>
            <View style={styles.dialogActions}>
              <Button onPress={() => setDeleteConfirmId(null)}>取消</Button>
              <Button
                mode="contained"
                onPress={() => deleteConfirmId && handleDeleteGame(deleteConfirmId)}
              >
                删除
              </Button>
            </View>
          </Surface>
        </View>
      </RNModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 24,
    textAlign: 'center',
  },
  newGameButton: {
    minWidth: 200,
  },
  divider: {
    marginHorizontal: 16,
  },
  savedGamesSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    opacity: 0.7,
    textAlign: 'center',
  },
  saveItem: {
    marginBottom: 8,
    borderRadius: 8,
  },
  saveContent: {
    paddingHorizontal: 8,
  },
  saveActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveDate: {
    fontSize: 12,
    opacity: 0.6,
    marginRight: 8,
  },
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
  dialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  dialogContent: {
    marginBottom: 16,
    lineHeight: 20,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});

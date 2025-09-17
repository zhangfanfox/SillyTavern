import React from 'react';
import { View, StyleSheet, Modal as RNModal } from 'react-native';
import { Button, Divider, RadioButton, Text, Surface } from 'react-native-paper';
import { useConnectionsStore } from '../src/stores/connections';
import { useParamsStore } from '../src/stores/params';
import { PROMPT_PROCESSING_TYPE } from '../src/services/prompt-converters';

export default function ParamsPanel({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const items = useConnectionsStore((s) => s.items);
  const current = items.find((x) => x.isDefault);
  const params = useParamsStore((s) => (current ? s.get(current.id) : undefined)) || {};
  const merge = useParamsStore((s) => s.merge);

  const promptMode = params.prompt_mode || PROMPT_PROCESSING_TYPE.MERGE;

  const setPromptMode = (mode: string) => {
    if (!current) return;
    merge(current.id, { prompt_mode: mode });
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Surface style={styles.modal} elevation={4}>
          <Text variant="titleMedium" style={styles.title}>参数设置</Text>
          <Divider style={styles.divider} />
          <Text variant="titleSmall" style={styles.section}>Prompt 模式</Text>
          <RadioButton.Group onValueChange={setPromptMode} value={promptMode}>
            <RadioButton.Item label="MERGE（合并）" value={PROMPT_PROCESSING_TYPE.MERGE} />
            <RadioButton.Item label="SEMI（半严格，带 example_* 前缀）" value={PROMPT_PROCESSING_TYPE.SEMI} />
            <RadioButton.Item label="STRICT（严格，带 example_* 前缀）" value={PROMPT_PROCESSING_TYPE.STRICT} />
            <RadioButton.Item label="SINGLE（折叠为单条）" value={PROMPT_PROCESSING_TYPE.SINGLE} />
            <RadioButton.Item label="TOOLS（工具模式）" value={PROMPT_PROCESSING_TYPE.TOOLS} />
          </RadioButton.Group>
          <View style={styles.actions}>
            <Button mode="contained" onPress={onDismiss}>关闭</Button>
          </View>
        </Surface>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    minWidth: 300,
    maxWidth: '90%',
  },
  title: { marginBottom: 4 },
  divider: { marginBottom: 8 },
  section: { marginTop: 8, marginBottom: 4 },
  actions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
});

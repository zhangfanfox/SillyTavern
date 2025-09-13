import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Divider, Portal, Modal, RadioButton, Text } from 'react-native-paper';
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
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
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
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', padding: 16, marginLeft: '20%', marginRight: 8, borderRadius: 12 },
  title: { marginBottom: 4 },
  divider: { marginBottom: 8 },
  section: { marginTop: 8, marginBottom: 4 },
  actions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
});

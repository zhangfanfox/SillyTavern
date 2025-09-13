import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, TextInput, Switch, Portal, Modal, RadioButton, List } from 'react-native-paper';
import { useConnectionsStore } from '../../src/stores/connections';
import { getProviderMeta } from '../../src/services/providerMeta';
import { useLocalSearchParams, router } from 'expo-router';

export default function EditConnectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, update, remove, setDefault, getSecretKey } = useConnectionsStore();
  const conn = items.find((x) => x.id === id);
  const [name, setName] = useState(conn?.name ?? '');
  const [model, setModel] = useState(conn?.model ?? '');
  const [baseUrl, setBaseUrl] = useState(conn?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [isDefault, setIsDefault] = useState(!!conn?.isDefault);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const META = useMemo(() => ({
    openai: getProviderMeta('openai'),
    claude: getProviderMeta('claude'),
    gemini: getProviderMeta('gemini'),
    openrouter: getProviderMeta('openrouter'),
  } as const), []);

  useEffect(() => {
    if (conn) {
      const m = META[conn.provider as keyof typeof META];
      if (!conn.baseUrl && m.baseUrl) setBaseUrl(m.baseUrl);
      if (!conn.model && m.models?.length) setModel(m.models[0]);
    }
  }, [conn, META]);

  useEffect(() => {
    (async () => {
      if (id) {
        const key = await getSecretKey(id);
        setApiKey(key ?? '');
      }
    })();
  }, [id]);

  if (!conn) return <View style={styles.container}><Text>未找到连接</Text></View>;

  const onSave = async () => {
    await update(conn.id, { name, model, baseUrl, apiKey });
    if (isDefault) setDefault(conn.id);
    router.back();
  };

  const onDelete = async () => {
    await remove(conn.id);
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text variant="titleLarge">编辑连接</Text>
      <TextInput label="名称" value={name} onChangeText={setName} mode="outlined" />
      {/* Base URL 默认隐藏，如确需自定义可在此处编辑 */}
      <TextInput label="Base URL（可选）" value={baseUrl} onChangeText={setBaseUrl} mode="outlined" />
  <Text>{META[conn.provider as keyof typeof META].modelLabel}</Text>
      <Button mode="outlined" onPress={() => setModelPickerOpen(true)}>{model || '选择模型'}</Button>
      <Portal>
        <Modal visible={modelPickerOpen} onDismiss={() => setModelPickerOpen(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>选择模型（{conn.provider}）</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            <RadioButton.Group onValueChange={(v) => setModel(v)} value={model}>
              {META[conn.provider as keyof typeof META].models.map((m) => (
                <List.Item key={m} title={m} onPress={() => setModel(m)} right={() => <RadioButton value={m} />} />
              ))}
            </RadioButton.Group>
          </ScrollView>
          <Button style={{ marginTop: 8 }} mode="contained" onPress={() => setModelPickerOpen(false)}>完成</Button>
        </Modal>
      </Portal>
  <TextInput label={META[conn.provider as keyof typeof META].apiKeyLabel} value={apiKey} onChangeText={setApiKey} secureTextEntry mode="outlined" />
      <View style={styles.row}>
        <Text>设为默认</Text>
        <Switch value={isDefault} onValueChange={setIsDefault} />
      </View>
      <Button mode="contained" onPress={onSave}>保存</Button>
      <Button mode="outlined" onPress={onDelete}>删除</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modal: { backgroundColor: 'white', padding: 16, margin: 16, borderRadius: 8 },
});

import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, TextInput, Switch, Portal, Modal, RadioButton, List, HelperText } from 'react-native-paper';
import { useConnectionsStore } from '../../src/stores/connections';
import { getProviderMeta } from '../../src/services/providerMeta';
import { useLocalSearchParams, router } from 'expo-router';
import { testConnection } from '../../src/services/llm';

export default function EditConnectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, update, remove, setDefault, getSecretKey } = useConnectionsStore();
  const conn = items.find((x) => x.id === id);
  const [name, setName] = useState(conn?.name ?? '');
  const [model, setModel] = useState(conn?.model ?? '');
  // Base URL 不再直接编辑；仅展示供应商与默认 Base URL
  const [apiKey, setApiKey] = useState('');
  const [isDefault, setIsDefault] = useState(!!conn?.isDefault);
  const [preferStream, setPreferStream] = useState(conn?.preferStream ?? true);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastValid, setLastValid] = useState<boolean | undefined>(conn?.isValid);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);

  const META = useMemo(() => ({
    openai: getProviderMeta('openai'),
    claude: getProviderMeta('claude'),
    gemini: getProviderMeta('gemini'),
    openrouter: getProviderMeta('openrouter'),
  } as const), []);

  useEffect(() => {
    if (conn) {
      const m = META[conn.provider as keyof typeof META];
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
  }, [id, getSecretKey]);

  if (!conn) return <View style={styles.container}><Text>未找到连接</Text></View>;

  const onSave = async () => {
    setTesting(true);
    await update(conn.id, { name, model, apiKey, preferStream });
    if (isDefault) setDefault(conn.id);
    setDebugLogs([]);
    const ok = await testConnection(conn.id, { onDebug: (e) => setDebugLogs((prev) => [...prev, e]) });
    setLastValid(ok);
    setTesting(false);
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
      {/* 供应商与默认 Base URL 信息（只读） */}
      <Text>供应商：{conn.provider}</Text>
      <Text>默认 Base URL：{META[conn.provider as keyof typeof META].baseUrl}</Text>
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
      {lastValid !== undefined && (
        <HelperText type={lastValid ? 'info' : 'error'}>
          {lastValid ? '连接有效' : '连接无效，请检查密钥/模型/网络'}
        </HelperText>
      )}
      {/* 调试输出（最近一次测试） */}
      {debugLogs.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text variant="titleSmall">调试</Text>
          {debugLogs.map((d, i) => (
            <Text key={i} selectable style={{ fontFamily: 'Courier', fontSize: 12 }}>
              {JSON.stringify(d)}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.row}>
        <Text>设为默认</Text>
        <Switch value={isDefault} onValueChange={setIsDefault} />
      </View>
      <View style={styles.row}>
        <Text>流式输出</Text>
        <Switch value={preferStream} onValueChange={setPreferStream} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button mode="contained" onPress={onSave} loading={testing} disabled={testing}>保存</Button>
        <Button mode="outlined" onPress={async () => { setTesting(true); setDebugLogs([]); const ok = await testConnection(conn.id, { onDebug: (e) => setDebugLogs((prev) => [...prev, e]) }); setLastValid(ok); setTesting(false); }} loading={testing} disabled={testing}>测试</Button>
        <Button mode="outlined" onPress={onDelete}>删除</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modal: { backgroundColor: 'white', padding: 16, margin: 16, borderRadius: 8 },
});

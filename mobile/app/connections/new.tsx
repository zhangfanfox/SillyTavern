import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, TextInput, RadioButton, Portal, Modal, List, HelperText } from 'react-native-paper';
import { useConnectionsStore, type ProviderId } from '../../src/stores/connections';
import { getProviderMeta } from '../../src/services/providerMeta';
import { router } from 'expo-router';
import { testConnection, testConnectionRaw } from '../../src/services/llm';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function NewConnectionScreen() {
  const add = useConnectionsStore((s) => s.add);
  const [name, setName] = useState('默认连接');
  const [provider, setProvider] = useState<ProviderId>('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com');
  const [model, setModel] = useState('gpt-4o-mini');
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const META = useMemo(() => ({
    openai: getProviderMeta('openai'),
    claude: getProviderMeta('claude'),
    gemini: getProviderMeta('gemini'),
    openrouter: getProviderMeta('openrouter'),
  }), []);

  useEffect(() => {
    const m = META[provider];
    if (m.baseUrl) setBaseUrl(m.baseUrl);
    if (m.models?.length) setModel((prev) => (m.models.includes(prev) ? prev : m.models[0]));
  }, [provider, META]);

  const [testing, setTesting] = useState(false);
  const [lastValid, setLastValid] = useState<boolean | undefined>(undefined);

  const onTest = async (id: string) => {
    setTesting(true);
    try {
      const ok = await testConnectionRaw({ provider, baseUrl, model }, apiKey);
      setLastValid(ok);
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    const id = uuid();
    await add({ id, name, provider, apiKey, baseUrl, model, isDefault: true });
    await onTest(id);
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text variant="titleLarge">新建 API 连接</Text>
      <TextInput label="名称" value={name} onChangeText={setName} mode="outlined" />
      <Text>Provider</Text>
      <RadioButton.Group onValueChange={(v) => setProvider(v as ProviderId)} value={provider}>
        <View style={styles.row}><RadioButton value="openai" /><Text>OpenAI</Text></View>
        <View style={styles.row}><RadioButton value="claude" /><Text>Claude</Text></View>
        <View style={styles.row}><RadioButton value="gemini" /><Text>Gemini</Text></View>
        <View style={styles.row}><RadioButton value="openrouter" /><Text>OpenRouter</Text></View>
      </RadioButton.Group>
      <TextInput label={META[provider].apiKeyLabel} value={apiKey} onChangeText={setApiKey} secureTextEntry mode="outlined" />
      {lastValid !== undefined && (
        <HelperText type={lastValid ? 'info' : 'error'}>
          {lastValid ? '连接有效' : '连接无效，请检查密钥/模型/网络'}
        </HelperText>
      )}
      {/* Base URL 不暴露在新建页面，跟随 provider 自动设置（如需修改可到编辑页） */}
  <Text>{getProviderMeta(provider).modelLabel}</Text>
      <Button mode="outlined" onPress={() => setModelPickerOpen(true)}>{model}</Button>
      <Portal>
        <Modal visible={modelPickerOpen} onDismiss={() => setModelPickerOpen(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>选择模型（{provider}）</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            <RadioButton.Group onValueChange={(v) => setModel(v)} value={model}>
              {getProviderMeta(provider).models.map((m) => (
                <List.Item
                  key={m}
                  title={m}
                  onPress={() => setModel(m)}
                  right={() => <RadioButton value={m} />}
                />
              ))}
            </RadioButton.Group>
          </ScrollView>
          <Button style={{ marginTop: 8 }} mode="contained" onPress={() => setModelPickerOpen(false)}>完成</Button>
        </Modal>
      </Portal>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button mode="contained" onPress={onSave} loading={testing} disabled={testing}>保存并设为默认</Button>
        <Button mode="outlined" onPress={async () => { await onTest('raw'); }} loading={testing} disabled={testing}>测试</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modal: { backgroundColor: 'white', padding: 16, margin: 16, borderRadius: 8 },
});

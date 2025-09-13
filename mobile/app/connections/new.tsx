import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, TextInput, RadioButton } from 'react-native-paper';
import { useConnectionsStore, type ProviderId } from '../../src/stores/connections';
import { router } from 'expo-router';

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

  const onSave = async () => {
    const id = uuid();
    await add({ id, name, provider, apiKey, baseUrl, model, isDefault: true });
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
      <TextInput label="API Key" value={apiKey} onChangeText={setApiKey} secureTextEntry mode="outlined" />
      <TextInput label="Base URL" value={baseUrl} onChangeText={setBaseUrl} mode="outlined" />
      <TextInput label="默认模型" value={model} onChangeText={setModel} mode="outlined" />
      <Button mode="contained" onPress={onSave}>保存并设为默认</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

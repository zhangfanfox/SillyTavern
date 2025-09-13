import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, TextInput, Switch } from 'react-native-paper';
import { useConnectionsStore } from '../../src/stores/connections';
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
      <TextInput label="Base URL" value={baseUrl} onChangeText={setBaseUrl} mode="outlined" />
      <TextInput label="默认模型" value={model} onChangeText={setModel} mode="outlined" />
      <TextInput label="API Key" value={apiKey} onChangeText={setApiKey} secureTextEntry mode="outlined" />
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
});

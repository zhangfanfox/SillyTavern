import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, TextInput, HelperText } from 'react-native-paper';
import { useRolesStore } from '../../src/stores/roles';

export default function RoleImportScreen() {
  const [url, setUrl] = useState('');
  const [json, setJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const importFromURL = useRolesStore((s) => s.importRoleFromURL);
  const importFromJSON = useRolesStore((s) => s.importRoleFromJSON);
  const jsonPlaceholder = '{\n  "name": "..."\n}';

  const onImportURL = async () => {
    setError(null);
    try {
      if (!url.trim()) return;
      await importFromURL(url.trim());
      setUrl('');
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  };

  const onImportJSON = async () => {
    setError(null);
    try {
      if (!json.trim()) return;
      await importFromJSON(json.trim());
      setJson('');
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="titleLarge">导入角色</Text>
      <Text>支持：SillyTavern JSON（v2/v3/简易）、部分平台 URL（JanitorAI 优先，后续扩展）。</Text>
      <View style={styles.section}>
        <Text variant="titleMedium">通过 URL</Text>
        <TextInput label="角色页面链接" value={url} onChangeText={setUrl} mode="outlined" placeholder="https://janitorai.com/characters/..." autoCapitalize="none" />
        <Button mode="contained" onPress={onImportURL} style={styles.mt8}>导入</Button>
      </View>
      <View style={styles.section}>
        <Text variant="titleMedium">粘贴 JSON</Text>
  <TextInput value={json} onChangeText={setJson} mode="outlined" multiline numberOfLines={10} placeholder={jsonPlaceholder} />
        <Button mode="contained" onPress={onImportJSON} style={styles.mt8}>导入</Button>
      </View>
      {!!error && (
        <View style={styles.section}>
          <HelperText type="error" visible={!!error}>{error}</HelperText>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  section: { marginTop: 12, gap: 8 },
  mt8: { marginTop: 8 },
});

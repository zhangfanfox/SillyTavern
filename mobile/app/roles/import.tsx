import React, { useRef, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Dialog, Portal, ProgressBar, Text, TextInput, HelperText, Snackbar } from 'react-native-paper';
import { useRolesStore } from '../../src/stores/roles';

export default function RoleImportScreen() {
  const [url, setUrl] = useState('');
  const [json, setJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inProgress, setInProgress] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);
  const importFromURL = useRolesStore((s) => s.importRoleFromURL) as unknown as (url: string, opts?: { signal?: AbortSignal; onProgress?: (stage: string) => void }) => Promise<any>;
  const importFromJSON = useRolesStore((s) => s.importRoleFromJSON);
  const jsonPlaceholder = '{\n  "name": "..."\n}';

  const onImportURL = async () => {
    setError(null);
    setSuccess(null);
    try {
      if (!url.trim()) return;
      console.info('[ImportScreen] Importing from URL:', url.trim());
      setInProgress(true);
      setProgressText('准备中…');
      abortRef.current = new AbortController();
  const role = await importFromURL(url.trim(), { signal: abortRef.current.signal, onProgress: (s: string) => setProgressText(s) });
      console.info('[ImportScreen] Import success, role:', role?.name);
      setUrl('');
      setSuccess(`导入成功：${role?.name ?? '角色'}`);
    } catch (e: any) {
      console.error('[ImportScreen] Import URL failed', e);
      const msg = String(e?.message || e);
      if (msg?.toLowerCase?.().includes('aborted')) setError('已取消导入');
      else setError(msg);
    } finally {
      setInProgress(false);
      setProgressText('');
      abortRef.current = null;
    }
  };

  const onImportJSON = async () => {
    setError(null);
    setSuccess(null);
    try {
      if (!json.trim()) return;
      console.info('[ImportScreen] Importing from JSON');
      setInProgress(true);
      abortRef.current = new AbortController();
      const role = await importFromJSON(json.trim());
      setJson('');
      setSuccess(`导入成功：${role?.name ?? '角色'}`);
    } catch (e: any) {
      console.error('[ImportScreen] Import JSON failed', e);
      setError(String(e?.message || e));
    } finally {
      setInProgress(false);
      abortRef.current = null;
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
      <Snackbar visible={!!success} onDismiss={() => setSuccess(null)} duration={4000}>{success}</Snackbar>
      <Portal>
        <Dialog visible={inProgress} dismissable={false} onDismiss={() => {}}>
          <Dialog.Title>正在导入</Dialog.Title>
          <Dialog.Content>
            <Text>{progressText || '下载与解析中…'}</Text>
            <ProgressBar indeterminate style={styles.modalProgress} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                try { abortRef.current?.abort(); console.log('[ImportScreen] User canceled import'); } catch {}
              }}
            >取消</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  section: { marginTop: 12, gap: 8 },
  mt8: { marginTop: 8 },
  modalProgress: { marginTop: 12 },
});

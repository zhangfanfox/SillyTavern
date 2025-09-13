import { useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, View, ScrollView } from 'react-native';
import { Button, Modal, Portal, Text, TextInput, Switch, List } from 'react-native-paper';
import { useUIStore, type UIState } from '../src/stores/ui';
import { useConnectionsStore } from '../src/stores/connections';
import { useParamsStore } from '../src/stores/params';
import { getProvider } from '../src/services/providers';

const WIDTH = Math.min(380, Math.floor(Dimensions.get('window').width * 0.9));

export default function RightParamsDrawer() {
  const open = useUIStore((s: UIState) => s.rightPanelOpen);
  const setOpen = useUIStore((s: UIState) => s.setRightPanelOpen);
  const items = useConnectionsStore((s) => s.items);
  const currentId = useConnectionsStore((s) => s.currentId ?? s.items.find((x) => x.isDefault)?.id);
  const current = useMemo(() => items.find((x) => x.id === currentId), [items, currentId]);
  const provider = useMemo(() => (current ? getProvider(current.provider as any) : undefined), [current]);
  const paramsByConn = useParamsStore((s) => s.byConnId);
  const setParams = useParamsStore((s) => s.set);
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (currentId) {
      const existing = paramsByConn[currentId] ?? {};
      setForm(existing);
    }
  }, [currentId, paramsByConn]);

  return (
    <Portal>
      <Modal visible={open} onDismiss={() => setOpen(false)} contentContainerStyle={styles.modal}>
        <View style={styles.header}>
          <Text variant="titleMedium">参数面板</Text>
          <Button compact onPress={() => setOpen(false)}>关闭</Button>
        </View>
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
          {current ? (
            <>
              <List.Item title={`连接：${current.name}`} description={current.provider} />
              {provider?.params.map((p) => (
                <View key={p.key} style={{ marginBottom: 8 }}>
                  {p.type === 'text' && (
                    <TextInput
                      label={p.key}
                      value={form[p.key] ?? ''}
                      onChangeText={(v) => setForm((f) => ({ ...f, [p.key]: v }))}
                      mode="outlined"
                    />
                  )}
                  {p.type === 'number' && (
                    <TextInput
                      keyboardType="decimal-pad"
                      label={`${p.key}${p.min !== undefined && p.max !== undefined ? ` (${p.min}-${p.max})` : ''}`}
                      value={form[p.key]?.toString?.() ?? ''}
                      onChangeText={(v) => setForm((f) => ({ ...f, [p.key]: Number(v) }))}
                      mode="outlined"
                    />
                  )}
                  {p.type === 'boolean' && (
                    <View style={styles.rowBetween}>
                      <Text>{p.key}</Text>
                      <Switch value={!!form[p.key]} onValueChange={(v) => setForm((f) => ({ ...f, [p.key]: v }))} />
                    </View>
                  )}
                </View>
              ))}
              <Button
                mode="contained"
                onPress={() => {
                  if (currentId) setParams(currentId, form);
                  setOpen(false);
                }}
              >
                应用
              </Button>
            </>
          ) : (
            <Text>请先创建并设为默认的 API 连接</Text>
          )}
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    marginLeft: 'auto',
    marginRight: 0,
    width: WIDTH,
    backgroundColor: 'white',
    padding: 16,
    height: '100%'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  content: {
    flex: 1
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  }
});

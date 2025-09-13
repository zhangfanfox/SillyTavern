import { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { Button, Text, TextInput, Divider } from 'react-native-paper';
import { createAbortController, streamChat } from '../../src/services/llm';
import { useConnectionsStore } from '../../src/stores/connections';

export default function ChatScreen() {
  const [input, setInput] = useState('你好！请用一两句话介绍一下你自己。');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const items = useConnectionsStore((s) => s.items);
  const defaultConn = items.find((x) => x.isDefault);
  const [debugLogs, setDebugLogs] = useState<Array<{ provider: string; url: string; phase: string; status?: number; request?: any; response?: any; error?: any }>>([]);
  const scrollRef = useRef<ScrollView | null>(null);

  const pushDebug = (d: any) => setDebugLogs((prev) => [...prev, d].slice(-20));

  const onSend = async () => {
    if (!defaultConn) {
      setOutput('请先在左侧“API 连接”里创建并设置一个默认连接');
      return;
    }
    setOutput('');
    setLoading(true);
    setDebugLogs([]);
    const controller = createAbortController();
    abortRef.current = controller;
    try {
      await streamChat({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: input },
        ],
        controller,
        onToken: (t) => setOutput((prev) => prev + t),
        onDone: () => setLoading(false),
        onError: (e) => {
          setLoading(false);
          setOutput(String(e?.message ?? e));
        },
        onDebug: (d) => pushDebug(d),
      });
    } finally {
      abortRef.current = null;
    }
  };

  const onStop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  // Auto scroll to bottom on new output or logs
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [output, debugLogs.length]);

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <Text variant="titleLarge">聊天（测试发送）</Text>
      <TextInput
        label="你的消息"
        mode="outlined"
        value={input}
        onChangeText={setInput}
        multiline
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button mode="contained" onPress={onSend} disabled={loading}>
          发送
        </Button>
        <Button mode="outlined" onPress={onStop} disabled={!loading}>
          停止
        </Button>
      </View>
      <Text style={{ opacity: 0.7 }}>默认连接：{defaultConn ? `${defaultConn.name} (${defaultConn.provider})` : '未设置'}</Text>
      <Text selectable style={{ marginTop: 12 }}>{output || '（等待输出）'}</Text>
      <Divider style={{ marginVertical: 12 }} />
      <Text variant="titleMedium">调试</Text>
      {debugLogs.length === 0 ? (
        <Text style={{ opacity: 0.7 }}>(无)</Text>
      ) : (
        debugLogs.map((d, i) => (
          <Text key={i} selectable style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontSize: 12 }}>
            {JSON.stringify(d)}
          </Text>
        ))
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 24, gap: 12 }
});

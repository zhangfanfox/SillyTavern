import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { createAbortController, streamChat, nonStreamOpenAIChat, nonStreamClaudeChat, nonStreamGeminiChat } from '../../src/services/llm';
import { useConnectionsStore } from '../../src/stores/connections';
import { STMessage } from '../../src/services/chat-serialization';
import { scheduleSaveCurrent, useChatStore } from '../../src/stores/chat';
import MessageList from '../../components/MessageList';
import ChatInput from '../../components/ChatInput';

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const [streamEnabled, setStreamEnabled] = useState(true);
  const items = useConnectionsStore((s) => s.items);
  const defaultConn = items.find((x) => x.isDefault);
  const chat = useChatStore();
  const session = useMemo(() => chat.currentId ? chat.sessions.find(s => s.id === chat.currentId) : undefined, [chat.currentId, chat.sessions]);
  const debugEventsRef = useRef<Array<{ provider: string; url: string; phase: 'request' | 'response' | 'error'; request?: any; response?: any; status?: number; error?: any }>>([]);

  useEffect(() => {
    (async () => {
      await chat.loadAllSessions();
      const hasAny = useChatStore.getState().sessions.length > 0;
      if (!hasAny) await chat.createSession('User', 'Assistant');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSend = async () => {
    if (!input.trim()) return;
    if (!session) return;
    if (!defaultConn) {
      const msg: STMessage = { name: 'System', is_user: false, is_system: true, send_date: Date.now(), mes: '请在左侧 API 连接里创建并设置一个默认连接。' };
      await chat.addMessage(session.id, msg);
      return;
    }

    const userMsg: STMessage = { name: 'User', is_user: true, send_date: Date.now(), mes: input } as STMessage;
    // Clear input immediately after capturing text
    setInput('');
    await chat.addMessage(session.id, userMsg);

    // Append an assistant placeholder, then compute its actual index from the latest store to avoid stale references
    const assistantMsg: STMessage = { name: 'Assistant', is_user: false, send_date: Date.now(), mes: '' } as STMessage;
    await chat.addMessage(session.id, assistantMsg);
    const latest = useChatStore.getState();
    const latestSession = latest.sessions.find((s) => s.id === session.id);
    const assistantIndex = latestSession ? latestSession.messages.length - 1 : 0;

    const controller = createAbortController();
    chat.setAbortController(controller);
    chat.setStreaming(true);
  // Reset debug buffer
  debugEventsRef.current = [];

    const redactUrl = (url: string) => url.replace(/([?&]key=)[^&#]+/i, '$1***');
    const safeString = (obj: any) => {
      try { return typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2); } catch { return String(obj); }
    };
    const buildErrorDump = () => {
      const arr = debugEventsRef.current || [];
      const req = arr.find((e) => e.phase === 'request');
      const resp = arr.find((e) => e.phase === 'response');
      const err = arr.find((e) => e.phase === 'error');
      const lines: string[] = [];
      if (req) {
        lines.push(`Provider: ${req.provider}`);
        lines.push(`URL: ${redactUrl(req.url)}`);
        if (req.request) {
          lines.push('Request JSON:');
          lines.push(safeString(req.request));
        }
      }
      if (resp) {
        lines.push(`Response Status: ${resp.status ?? ''}`);
        if (resp.response !== undefined) {
          lines.push('Response Body:');
          lines.push(safeString(resp.response));
        }
      }
      if (err && !resp) {
        lines.push('Error:');
        lines.push(safeString(err.error));
      }
      const text = lines.join('\n');
      // Truncate extremely long debug dump to avoid UI freeze
      return text.length > 20000 ? text.slice(0, 20000) + '\n...[truncated]...' : text;
    };

    try {
      const allMsgs = (latestSession?.messages || session.messages);
      // Exclude the assistant placeholder itself from the prompt
      const promptMsgs = allMsgs.filter((_, idx) => idx !== assistantIndex);
      const mapped = promptMsgs.map((m) => ({
        role: (m as any).is_system ? ('system' as const) : (m.is_user ? ('user' as const) : ('assistant' as const)),
        content: m.mes,
      }));
      const common = {
        controller,
        onToken: (t: string) => { chat.appendToMessage(session.id, assistantIndex, t); scheduleSaveCurrent(400); },
        onDone: () => { chat.setStreaming(false); scheduleSaveCurrent(0); },
        onError: (e: any) => {
          chat.setStreaming(false);
          const dump = buildErrorDump();
          chat.appendToMessage(session.id, assistantIndex, `\n[Error] ${String(e)}\n${dump}`);
        },
        onDebug: (evt) => { debugEventsRef.current?.push(evt); },
      };

      const payload = [{ role: 'system', content: 'You are a helpful assistant.' }, ...mapped] as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      if (streamEnabled) {
        await streamChat({ messages: payload, ...common });
      } else {
        const provider = defaultConn?.provider;
        if (provider === 'openai' || provider === 'openrouter') {
          await nonStreamOpenAIChat({ connectionId: defaultConn.id, messages: payload, ...common });
        } else if (provider === 'claude') {
          await nonStreamClaudeChat({ connectionId: defaultConn.id, messages: payload, ...common });
        } else if (provider === 'gemini') {
          await nonStreamGeminiChat({ connectionId: defaultConn.id, messages: payload, ...common });
        } else {
          // fallback try streaming
          await streamChat({ messages: payload, ...common });
        }
      }
    } finally {
      chat.setAbortController(null);
    }
  };

  const onStop = () => {
    chat.stream.abortController?.abort();
    chat.setStreaming(false);
  };

  return (
    <View style={styles.container}>
      <Text variant="titleLarge">聊天</Text>
      <View style={styles.listContainer}>
        <MessageList messages={session?.messages || []} userName={session?.userName || 'User'} characterName={session?.characterName || 'Assistant'} streaming={!!chat.stream.streaming} />
      </View>
      <ChatInput value={input} onChangeText={setInput} onSend={onSend} onStop={onStop} loading={!!chat.stream.streaming} streamEnabled={streamEnabled} onToggleStream={() => setStreamEnabled((v) => !v)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 8 },
  listContainer: { flex: 1 },
});

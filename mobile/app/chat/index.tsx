import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { createAbortController, streamChat, nonStreamOpenAIChat, nonStreamClaudeChat, nonStreamGeminiChat } from '../../src/services/llm';
import { useConnectionsStore } from '../../src/stores/connections';
import { STMessage } from '../../src/services/chat-serialization';
import { scheduleSaveCurrent, useChatStore } from '../../src/stores/chat';
import MessageList from '../../components/MessageList';
import ChatInput from '../../components/ChatInput';
import DraggableDebugPanel from '../../components/DraggableDebugPanel';
import { postProcessPrompt, PROMPT_PROCESSING_TYPE } from '../../src/services/prompt-converters';
import { useRolesStore } from '../../src/stores/roles';

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [debugVisible, setDebugVisible] = useState(false);
  const assistantBufferRef = useRef<string>('');
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
      let allMsgs = (latestSession?.messages || session.messages);
      // Exclude the assistant placeholder itself from the prompt
      let promptMsgs = allMsgs.filter((_, idx) => idx !== assistantIndex);
      // If there is no system message yet, try to inject from the matched role by characterName
      const hasSysInPrompt = promptMsgs.some((m) => (m as any).is_system);
      if (!hasSysInPrompt) {
        try {
          const rolesState = useRolesStore.getState();
          const role = rolesState.roles.find((r) => r.name === session.characterName);
          const sys = role?.system_prompt?.trim();
          if (sys) {
            const sysMsg: STMessage = { name: 'System', is_user: false, is_system: true, send_date: Date.now(), mes: sys } as STMessage;
            promptMsgs = [sysMsg, ...promptMsgs];
            try { console.log('[Chat] Injected role system prompt', { role: role?.name, sysLen: sys.length }); } catch {}
          }
        } catch {}
      }
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
          try { console.error('[Chat] Request failed', e, '\
', dump); } catch {}
          chat.appendToMessage(session.id, assistantIndex, `\n[Error] ${String(e)}\n${dump}`);
        },
  onDebug: (evt: any) => { debugEventsRef.current?.push(evt); try {
    const safe = (o: any) => { try { return typeof o === 'string' ? o : JSON.stringify(o); } catch { return String(o); } };
    if (evt.phase === 'error') console.error('[LLM][DEBUG]', evt.provider, evt.phase, evt.url, safe(evt));
    else console.log('[LLM][DEBUG]', evt.provider, evt.phase, evt.url, safe(evt));
  } catch {} },
      };

  // Compose provider-agnostic ChatML
      const hasSystem = mapped.some((m) => m.role === 'system');
      // Derive a system prompt from role when missing
      let derivedSys: string | undefined;
      if (!hasSystem) {
        try {
          const { roles } = useRolesStore.getState();
          const role = roles.find((r) => r.name === session.characterName);
          if (role) {
            const base = (role.system_prompt || '').trim();
            if (base) derivedSys = base;
            else if (role.description) derivedSys = `You are ${role.name}. ${role.description}. Stay in character and speak in first person as ${role.name}.`;
          }
        } catch {}
      }
      if (!hasSystem && !derivedSys) derivedSys = 'You are a helpful assistant.';
      let payload = (hasSystem ? mapped : [{ role: 'system', content: derivedSys! }, ...mapped]) as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  try { console.log('[Chat] Selected systemPrompt', { source: hasSystem ? 'existing' : (derivedSys === 'You are a helpful assistant.' ? 'fallback' : 'role'), len: (payload.find(m => m.role === 'system')?.content || '').length }); } catch {}
      // Minimal ST-like merge post-processing
      payload = postProcessPrompt(payload as any, PROMPT_PROCESSING_TYPE.MERGE, {
        charName: session.characterName,
        userName: session.userName,
        groupNames: [],
        startsWithGroupName: () => false,
      }) as any;

      // Provider-specific pre-adjustments:
      // Gemini v1 models don't accept systemInstruction; emulate ST by prepending system text into the first user message
      const provider = defaultConn?.provider;
      if (provider === 'gemini') {
        // Fold system into first user for Gemini v1
        const sys = payload.find((m) => m.role === 'system')?.content?.trim();
        if (sys) {
          const idx = payload.findIndex((m) => m.role !== 'system');
          if (idx >= 0) {
            const first = payload[idx];
            const joined = first.content ? `${sys}\n\n${first.content}` : sys;
            payload = [...payload];
            payload[idx] = { ...first, content: joined } as any;
          }
          // Remove the system message to avoid being ignored downstream
          payload = payload.filter((m) => m.role !== 'system');
          try { console.log('[Chat] Gemini folded system into user', { sysLen: sys.length, firstUserLen: (payload[0]?.content || '').length }); } catch {}
        }
      }
      assistantBufferRef.current = '';
      try { console.log('[Chat] Sending', { provider, payload }); } catch {}
      if (streamEnabled) {
        await streamChat({
          messages: payload,
          ...common,
          onToken: (t: string) => { assistantBufferRef.current += t; common.onToken?.(t); },
          onDone: () => { try { console.log('[Chat] Response done', { provider, length: assistantBufferRef.current.length, preview: assistantBufferRef.current.slice(0, 120) }); } catch {} common.onDone?.(); },
        });
      } else {
        if (provider === 'openai' || provider === 'openrouter') {
          await nonStreamOpenAIChat({ connectionId: defaultConn.id, messages: payload, ...common, onToken: (t) => { assistantBufferRef.current += t; common.onToken?.(t); }, onDone: () => { try { console.log('[Chat] Response done', { provider, length: assistantBufferRef.current.length, preview: assistantBufferRef.current.slice(0, 120) }); } catch {} common.onDone?.(); } });
        } else if (provider === 'claude') {
          await nonStreamClaudeChat({ connectionId: defaultConn.id, messages: payload, ...common, onToken: (t) => { assistantBufferRef.current += t; common.onToken?.(t); }, onDone: () => { try { console.log('[Chat] Response done', { provider, length: assistantBufferRef.current.length, preview: assistantBufferRef.current.slice(0, 120) }); } catch {} common.onDone?.(); } });
        } else if (provider === 'gemini') {
          await nonStreamGeminiChat({ connectionId: defaultConn.id, messages: payload, ...common, onToken: (t) => { assistantBufferRef.current += t; common.onToken?.(t); }, onDone: () => { try { console.log('[Chat] Response done', { provider, length: assistantBufferRef.current.length, preview: assistantBufferRef.current.slice(0, 120) }); } catch {} common.onDone?.(); } });
        } else {
          // fallback try streaming
          await streamChat({ messages: payload, ...common, onToken: (t: string) => { assistantBufferRef.current += t; common.onToken?.(t); }, onDone: () => { try { console.log('[Chat] Response done', { provider, length: assistantBufferRef.current.length, preview: assistantBufferRef.current.slice(0, 120) }); } catch {} common.onDone?.(); } });
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
      <View style={styles.header}>
        <Text variant="titleLarge">{session?.title || '聊天'}</Text>
        <IconButton icon={debugVisible ? 'bug-check' : 'bug'} onPress={() => setDebugVisible((v) => !v)} accessibilityLabel="切换调试面板" />
      </View>
      <View style={styles.listContainer}>
        <MessageList messages={session?.messages || []} userName={session?.userName || 'User'} characterName={session?.characterName || 'Assistant'} streaming={!!chat.stream.streaming} />
      </View>
      <ChatInput value={input} onChangeText={setInput} onSend={onSend} onStop={onStop} loading={!!chat.stream.streaming} streamEnabled={streamEnabled} onToggleStream={() => setStreamEnabled((v) => !v)} />
      <DraggableDebugPanel visible={debugVisible} onClose={() => setDebugVisible(false)} content={(function () {
        const arr = debugEventsRef.current || [];
        const safe = (o: any) => { try { return typeof o === 'string' ? o : JSON.stringify(o, null, 2); } catch { return String(o); } };
        return arr.map((e) => `# ${e.phase.toUpperCase()} - ${e.provider}\nURL: ${e.url}\n` +
          (e.request ? `Request:\n${safe(e.request)}\n` : '') +
          (e.status !== undefined ? `Status: ${e.status}\n` : '') +
          (e.response !== undefined ? `Response:\n${safe(e.response)}\n` : '') +
          (e.error ? `Error:\n${safe(e.error)}\n` : '')).join('\n');
      })()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listContainer: { flex: 1 },
});

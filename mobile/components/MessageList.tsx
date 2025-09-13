import React, { useMemo, useEffect, useRef } from 'react';
import { Animated, FlatList, Image, StyleSheet, Text as RNText, View } from 'react-native';
import { Text } from 'react-native-paper';
import { STMessage } from '../src/services/chat-serialization';

export type MessageListProps = {
  messages: STMessage[];
  userName: string;
  characterName: string;
  height?: number | string;
  streaming?: boolean;
};

export default function MessageList({ messages, userName, characterName, streaming }: MessageListProps) {
  const data = useMemo(() => messages.map((m, i) => ({ key: String(i), item: m, index: i })), [messages]);
  return (
    <FlatList
      data={data}
      renderItem={({ item }) => {
        const isLast = item.index === messages.length - 1;
        const m = item.item;
        const isTyping = !!streaming && isLast && !m.is_user && (!m.mes || m.mes.length === 0);
        return (
          <MessageBubble message={m} userName={userName} characterName={characterName} isTyping={isTyping} />
        );
      }}
      keyExtractor={(i) => i.key}
      contentContainerStyle={styles.list}
    />
  );
}

function MessageBubble({ message, userName, characterName, isTyping }: { message: STMessage; userName: string; characterName: string; isTyping?: boolean; }) {
  const isUser = !!message.is_user;
  const name = message.name || (isUser ? userName : characterName);
  const text = (message.extra as any)?.display_text ?? message.mes;
  const ts = formatTimestamp(message.send_date);
  return (
    <View style={[styles.bubbleRow, isUser ? styles.right : styles.left]}>
      {!isUser && (
        <Image source={{ uri: message.extra?.force_avatar ?? 'https://placehold.co/40x40/png' }} style={styles.avatar} />
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.charBubble]}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{name}</Text>
          {!!ts && <Text style={styles.timestamp}>{ts}</Text>}
        </View>
        {(!isUser && (!text || text.length === 0) && isTyping) ? (
          <TypingDots />
        ) : (
          <RNText style={styles.text}>{text}</RNText>
        )}
      </View>
      {isUser && (
        <Image source={{ uri: message.extra?.force_avatar ?? 'https://placehold.co/40x40/png?text=U' }} style={styles.avatar} />
      )}
    </View>
  );
}

function TypingDots() {
  return (
    <View style={styles.dotsRow}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity]);
  return <Animated.View style={[styles.dot, { opacity }]} />;
}

function formatTimestamp(sendDate: number | string | undefined): string {
  if (sendDate === undefined || sendDate === null) return '';
  try {
    const d = typeof sendDate === 'number' ? new Date(sendDate) : new Date(sendDate);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${dd} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginHorizontal: 8, backgroundColor: '#ddd' },
  bubble: { maxWidth: '78%', borderRadius: 12, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  userBubble: { backgroundColor: '#e6f0ff', borderColor: '#c7dcff' },
  charBubble: { backgroundColor: '#ffffff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { fontSize: 12, opacity: 0.7, marginBottom: 4 },
  timestamp: { fontSize: 11, opacity: 0.5, marginLeft: 8 },
  text: { color: '#111827', fontSize: 16, lineHeight: 22 },
  dotsRow: { flexDirection: 'row', gap: 6, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9ca3af' },
});

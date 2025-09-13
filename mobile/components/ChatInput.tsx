import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, TextInput, Switch, Text } from 'react-native-paper';

export default function ChatInput({ value, onChangeText, onSend, onStop, loading, streamEnabled, onToggleStream }: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  streamEnabled?: boolean;
  onToggleStream?: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          mode="outlined"
          placeholder="随便聊聊…"
          value={value}
          onChangeText={onChangeText}
          multiline
          style={styles.input}
        />
        <Button
          mode={loading ? 'outlined' : 'contained'}
          onPress={loading ? onStop : onSend}
          disabled={!loading && value.trim().length === 0}
          style={styles.actionBtn}
        >
          {loading ? '停止' : '发送'}
        </Button>
      </View>
      {onToggleStream && (
        <View style={styles.toggleRow}>
          <Text style={styles.switchLabel}>流式输出</Text>
          <Switch value={!!streamEnabled} onValueChange={onToggleStream} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1 },
  actionBtn: { alignSelf: 'flex-end' },
  toggleRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  switchLabel: { fontSize: 12 },
});

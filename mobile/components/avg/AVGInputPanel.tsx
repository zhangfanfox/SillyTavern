import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { AVGInputPanelProps } from '../../src/types/avg';

// Placeholder Input Panel component - will be implemented in task 5.3
export default function AVGInputPanel({
  visible,
  onSubmit,
  onCancel,
}: AVGInputPanelProps) {
  const [text, setText] = useState('');

  if (!visible) return null;

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text.trim());
      setText('');
    }
  };

  const handleCancel = () => {
    setText('');
    onCancel();
  };

  return (
    <View style={styles.container}>
      <TextInput
        label="输入你的回复..."
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={3}
        style={styles.input}
      />
      <View style={styles.buttonRow}>
        <Button
          mode="outlined"
          onPress={handleCancel}
          style={styles.button}
        >
          取消
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={!text.trim()}
          style={styles.button}
        >
          发送
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    minWidth: 80,
  },
});

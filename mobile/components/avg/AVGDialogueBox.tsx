import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from 'react-native-paper';
import { AVGDialogueBoxProps } from '../../src/types/avg';

// Placeholder Dialogue Box component - will be implemented in task 5.1
export default function AVGDialogueBox({
  speaker,
  text,
  isStreaming,
  onComplete,
}: AVGDialogueBoxProps) {
  React.useEffect(() => {
    if (!isStreaming && onComplete) {
      onComplete();
    }
  }, [isStreaming, onComplete]);

  return (
    <Card style={styles.container}>
      <Card.Content>
        <Text style={styles.speaker}>{speaker}</Text>
        <Text style={styles.text}>
          {text}
          {isStreaming && <Text style={styles.cursor}>|</Text>}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    minHeight: 80,
  },
  speaker: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  cursor: {
    opacity: 0.7,
  },
});

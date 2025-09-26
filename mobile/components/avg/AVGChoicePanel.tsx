import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { AVGChoicePanelProps } from '../../src/types/avg';

// Placeholder Choice Panel component - will be implemented in task 5.2
export default function AVGChoicePanel({ 
  choices, 
  onChoiceSelect, 
  visible 
}: AVGChoicePanelProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      {choices.map((choice) => (
        <Button
          key={choice.id}
          mode="outlined"
          onPress={() => onChoiceSelect(choice)}
          style={styles.choice}
        >
          {choice.text}
        </Button>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 8,
  },
  choice: {
    marginVertical: 4,
  },
});
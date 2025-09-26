import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AVGCanvasProps } from '../../src/types/avg';

// Placeholder Canvas component - will be implemented in task 2.1
export default function AVGCanvas({ 
  backgroundImage, 
  characterImage, 
  characterPosition, 
  onCanvasReady 
}: AVGCanvasProps) {
  React.useEffect(() => {
    // Simulate canvas ready
    onCanvasReady();
  }, [onCanvasReady]);

  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Canvas渲染区域</Text>
      <Text style={styles.info}>背景: {backgroundImage}</Text>
      {characterImage && (
        <Text style={styles.info}>角色: {characterImage}</Text>
      )}
      {characterPosition && (
        <Text style={styles.info}>
          位置: ({characterPosition.x}, {characterPosition.y})
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 8,
  },
  placeholder: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  info: {
    fontSize: 12,
    opacity: 0.7,
    marginVertical: 2,
  },
});
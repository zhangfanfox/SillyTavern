import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { router } from 'expo-router';

export default function AVGIndexScreen() {
  const handleStartNewGame = () => {
    // Generate a new session ID and navigate to the game screen
    const sessionId = `avg-${Date.now()}`;
    router.push(`/avg/game/${sessionId}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AVG 故事模式</Text>
      <Text style={styles.subtitle}>沉浸式AI故事体验</Text>
      
      <View style={styles.buttonContainer}>
        <Button 
          mode="contained" 
          onPress={handleStartNewGame}
          style={styles.button}
        >
          开始新游戏
        </Button>
        
        <Button 
          mode="outlined" 
          onPress={() => {/* TODO: Load saved games */}}
          style={styles.button}
        >
          加载存档
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  button: {
    marginVertical: 8,
  },
});
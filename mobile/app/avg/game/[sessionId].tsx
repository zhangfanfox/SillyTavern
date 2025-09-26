import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAVGStore } from '../../../src/stores/avg';
import { useAVGCanvas } from '../../../src/hooks/useAVGCanvas';
import AVGCanvas from '../../../components/avg/AVGCanvas';
import AVGDialogueBox from '../../../components/avg/AVGDialogueBox';
import AVGChoicePanel from '../../../components/avg/AVGChoicePanel';
import AVGInputPanel from '../../../components/avg/AVGInputPanel';

export default function AVGGameScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const avgStore = useAVGStore();
  const { canvasRef, handleCanvasReady, loadBackground, loadCharacter, updateCharacter, fadeCharacter } = useAVGCanvas();

  useEffect(() => {
    if (sessionId) {
      // Initialize or load game session
      avgStore.initializeGame({
        sessionId,
        characterName: 'Assistant',
        userName: 'User',
        initialScene: 'default',
      });
    }
  }, [sessionId, avgStore]);

  const onCanvasReady = () => {
    console.log('[AVG] Canvas ready for session:', sessionId);
    handleCanvasReady();

    // Load initial scene assets
    if (avgStore.currentScene.backgroundImage) {
      loadBackground(avgStore.currentScene.backgroundImage);
    }
    if (avgStore.currentScene.character?.image && avgStore.currentScene.character?.position) {
      loadCharacter(avgStore.currentScene.character.image, avgStore.currentScene.character.position);

      // Demo: Test character animation after 3 seconds
      setTimeout(() => {
        console.log('[AVG] Testing character animation...');
        updateCharacter({ x: 0.7, y: 0.8, scale: 1.2 }, 'happy');
      }, 3000);

      // Demo: Test character fade after 6 seconds
      setTimeout(() => {
        console.log('[AVG] Testing character fade...');
        fadeCharacter(0.5, 1000);
      }, 6000);

      // Demo: Fade back in after 8 seconds
      setTimeout(() => {
        console.log('[AVG] Fading character back in...');
        fadeCharacter(1.0, 1000);
      }, 8000);
    }
  };

  const handleChoiceSelect = (choice: any) => {
    console.log('[AVG] Choice selected:', choice);
    avgStore.setChoicePanelVisible(false);
  };

  const handleInputSubmit = (text: string) => {
    console.log('[AVG] Input submitted:', text);
    avgStore.setInputPanelVisible(false);
  };

  const handleInputCancel = () => {
    avgStore.setInputPanelVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Canvas rendering area */}
      <AVGCanvas
        ref={canvasRef}
        backgroundImage={avgStore.currentScene.backgroundImage}
        characterImage={avgStore.currentScene.character?.image}
        characterPosition={avgStore.currentScene.character?.position}
        onCanvasReady={onCanvasReady}
      />

      {/* Dialogue box */}
      <AVGDialogueBox
        speaker={avgStore.currentScene.character?.name || 'Assistant'}
        text={avgStore.streamingText || '欢迎来到AVG故事模式！'}
        isStreaming={avgStore.isStreaming}
      />

      {/* Choice panel */}
      <AVGChoicePanel
        choices={[]} // Will be populated by AI service in later tasks
        onChoiceSelect={handleChoiceSelect}
        visible={avgStore.isChoicePanelVisible}
      />

      {/* Input panel */}
      <AVGInputPanel
        visible={avgStore.isInputPanelVisible}
        onSubmit={handleInputSubmit}
        onCancel={handleInputCancel}
      />
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
  placeholder: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  note: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
});

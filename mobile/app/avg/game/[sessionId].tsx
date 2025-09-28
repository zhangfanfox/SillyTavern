import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Alert, BackHandler } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Text, ProgressBar } from 'react-native-paper';
import { useAVGStore } from '../../../src/stores/avg';
import { useAVGCanvas } from '../../../src/hooks/useAVGCanvas';
import AVGCanvas from '../../../components/avg/AVGCanvas';
import AVGDialogueBox from '../../../components/avg/AVGDialogueBox';
import AVGChoicePanel from '../../../components/avg/AVGChoicePanel';
import AVGInputPanel from '../../../components/avg/AVGInputPanel';
import { Choice } from '../../../src/types/avg';
import { avgPreloaderService, PreloadProgress } from '../../../src/services/avg-preloader';

export default function AVGGameScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const avgStore = useAVGStore();
  const { canvasRef, handleCanvasReady, loadBackground, loadCharacter, updateCharacter, fadeCharacter } = useAVGCanvas();
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [preloadProgress, setPreloadProgress] = useState<PreloadProgress | null>(null);
  const [initializationStep, setInitializationStep] = useState<string>('准备中...');

  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true; // Prevent default behavior
    });

    return () => backHandler.remove();
  }, []);

  // Initialize game session
  useEffect(() => {
    if (sessionId) {
      initializeGameSession();
    }
  }, [sessionId]);

  const initializeGameSession = async () => {
    try {
      setIsInitializing(true);
      setInitializationError(null);
      setPreloadProgress(null);

      console.log('[AVG] Starting game initialization for session:', sessionId);

      // Step 1: Validate and prepare configuration
      setInitializationStep('验证游戏配置...');
      const initResult = await avgPreloaderService.initializeGame({
        sessionId,
        characterName: 'Assistant',
        userName: 'User',
        initialScene: 'default',
      });

      if (!initResult.success) {
        throw new Error(initResult.error || '配置验证失败');
      }

      console.log('[AVG] Configuration validated successfully');

      // Step 2: Initialize game store
      setInitializationStep('初始化游戏状态...');
      await avgStore.initializeGame(initResult.config!);

      // Step 3: Preload assets
      setInitializationStep('预加载游戏资源...');
      const preloadResult = await avgPreloaderService.preloadGameAssets(
        initResult.config!,
        initResult.scene!,
        (progress) => {
          setPreloadProgress(progress);
          setInitializationStep(`加载资源 (${progress.current}/${progress.total}): ${progress.currentAsset}`);
        }
      );

      if (!preloadResult.success) {
        console.warn('[AVG] Some assets failed to preload:', preloadResult.failedAssets);
        // Don't fail initialization for asset loading failures, just warn
      }

      console.log('[AVG] Game session initialized successfully');
      setInitializationStep('初始化完成');
      
      // Small delay to show completion
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      
      setIsInitializing(false);
    } catch (error) {
      console.error('[AVG] Failed to initialize game session:', error);
      setInitializationError(error instanceof Error ? error.message : '游戏初始化失败，请重试');
      setIsInitializing(false);
    }
  };

  const handleBackPress = useCallback(() => {
    Alert.alert(
      '退出游戏',
      '确定要退出当前游戏吗？游戏进度已自动保存。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '退出', 
          style: 'destructive',
          onPress: () => {
            // Save current state before leaving
            avgStore.saveGameState();
            router.back();
          }
        },
      ]
    );
  }, [avgStore]);

  const onCanvasReady = useCallback(() => {
    console.log('[AVG] Canvas ready for session:', sessionId);
    handleCanvasReady();

    // Load initial scene assets
    const scene = avgStore.currentScene;
    if (scene.backgroundImage) {
      loadBackground(scene.backgroundImage).catch(error => {
        console.warn('[AVG] Failed to load background:', error);
      });
    }
    
    if (scene.character?.image && scene.character?.position) {
      loadCharacter(scene.character.image, scene.character.position).catch(error => {
        console.warn('[AVG] Failed to load character:', error);
      });
    }
  }, [sessionId, avgStore.currentScene, handleCanvasReady, loadBackground, loadCharacter]);

  const handleChoiceSelect = useCallback(async (choice: Choice) => {
    console.log('[AVG] Choice selected:', choice);
    
    // Hide choice panel
    avgStore.setChoicePanelVisible(false);
    
    // Process the choice through AI service
    try {
      await avgStore.startStreamingResponse(choice.text);
    } catch (error) {
      console.error('[AVG] Failed to process choice:', error);
      Alert.alert('错误', '处理选择时发生错误，请重试');
    }
  }, [avgStore]);

  const handleInputSubmit = useCallback(async (text: string) => {
    console.log('[AVG] Input submitted:', text);
    
    if (!text.trim()) {
      Alert.alert('提示', '请输入有效内容');
      return;
    }

    // Hide input panel
    avgStore.setInputPanelVisible(false);
    
    // Process the input through AI service
    try {
      await avgStore.startStreamingResponse(text.trim());
    } catch (error) {
      console.error('[AVG] Failed to process input:', error);
      Alert.alert('错误', '处理输入时发生错误，请重试');
    }
  }, [avgStore]);

  const handleInputCancel = useCallback(() => {
    avgStore.setInputPanelVisible(false);
  }, [avgStore]);

  const handleDialogueComplete = useCallback(() => {
    // When dialogue is complete, show interaction options
    // For now, show input panel to allow free input
    avgStore.setInputPanelVisible(true);
  }, [avgStore]);

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{initializationStep}</Text>
        {preloadProgress && (
          <View style={styles.progressContainer}>
            <ProgressBar 
              progress={preloadProgress.percentage / 100} 
              style={styles.progressBar}
            />
            <Text style={styles.progressText}>
              {preloadProgress.percentage}% ({preloadProgress.current}/{preloadProgress.total})
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Show error screen if initialization failed
  if (initializationError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{initializationError}</Text>
        <Text style={styles.errorSubtext}>请检查网络连接后重试</Text>
      </View>
    );
  }

  // Get current dialogue text
  const currentDialogueText = avgStore.streamingText || 
    (avgStore.dialogueHistory.length > 0 
      ? avgStore.dialogueHistory[avgStore.dialogueHistory.length - 1]?.text 
      : '点击下方开始对话...');

  const currentSpeaker = avgStore.isStreaming 
    ? avgStore.gameConfig?.characterName || 'Assistant'
    : (avgStore.dialogueHistory.length > 0 
        ? avgStore.dialogueHistory[avgStore.dialogueHistory.length - 1]?.speaker 
        : avgStore.gameConfig?.characterName || 'Assistant');

  return (
    <View style={styles.container}>
      {/* Canvas rendering area - takes full screen */}
      <AVGCanvas
        ref={canvasRef}
        backgroundImage={avgStore.currentScene.backgroundImage}
        characterImage={avgStore.currentScene.character?.image}
        characterPosition={avgStore.currentScene.character?.position}
        onCanvasReady={onCanvasReady}
        style={styles.canvas}
      />

      {/* Dialogue box - positioned at bottom */}
      <AVGDialogueBox
        speaker={currentSpeaker}
        text={currentDialogueText}
        isStreaming={avgStore.isStreaming}
        onComplete={handleDialogueComplete}
        style={styles.dialogueBox}
      />

      {/* Choice panel - overlay when visible */}
      <AVGChoicePanel
        choices={[]} // Will be populated by AI service in later tasks
        onChoiceSelect={handleChoiceSelect}
        visible={avgStore.isChoicePanelVisible}
        style={styles.choicePanel}
      />

      {/* Input panel - overlay when visible */}
      <AVGInputPanel
        visible={avgStore.isInputPanelVisible}
        onSubmit={handleInputSubmit}
        onCancel={handleInputCancel}
        style={styles.inputPanel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Black background for immersive experience
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dialogueBox: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  choicePanel: {
    position: 'absolute',
    bottom: 120, // Above dialogue box
    left: 20,
    right: 20,
  },
  inputPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  progressContainer: {
    marginTop: 24,
    width: '80%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: '#ccc',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
});

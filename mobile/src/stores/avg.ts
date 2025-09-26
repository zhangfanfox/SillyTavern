import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AVGState,
  GameConfig,
  SceneData,
  DialogueEntry,
  GameSave,
  DEFAULT_SCENE,
  DEFAULT_GAME_CONFIG,
  StreamCallbacks,
  DialogueContext,
} from '../types/avg';
import { avgSaveManager } from '../services/avg-save-manager';
import { avgStreamingService } from '../services/avg-streaming';
import { avgAIService } from '../services/avg-ai';

export const useAVGStore = create<AVGState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSession: undefined,
      currentScene: DEFAULT_SCENE,
      dialogueHistory: [],
      gameConfig: undefined,

      // UI state
      isDialogueActive: false,
      isChoicePanelVisible: false,
      isInputPanelVisible: false,

      // Streaming state
      streamingText: '',
      isStreaming: false,

      // Actions
      initializeGame: async (config: GameConfig) => {
        console.log('[AVG] Initializing game with config:', config);

        // Try to load existing save first
        const loadResult = await avgSaveManager.loadGame(config.sessionId);

        if (loadResult.success && loadResult.data) {
          // Load from existing save
          set({
            currentSession: config.sessionId,
            gameConfig: loadResult.data.gameConfig,
            currentScene: loadResult.data.currentScene,
            dialogueHistory: loadResult.data.dialogueHistory,
            isDialogueActive: false,
            isChoicePanelVisible: false,
            isInputPanelVisible: false,
            streamingText: '',
            isStreaming: false,
          });
          console.log('[AVG] Loaded existing save for session:', config.sessionId);
        } else {
          // Create new game
          const initialConfig = { ...DEFAULT_GAME_CONFIG, ...config };
          const initialScene = { ...DEFAULT_SCENE };

          // Add initial system message if system prompt exists
          const initialDialogue: DialogueEntry[] = [];
          if (initialConfig.systemPrompt) {
            initialDialogue.push({
              id: `system-${Date.now()}`,
              timestamp: Date.now(),
              speaker: 'System',
              text: initialConfig.systemPrompt,
              type: 'system',
              sceneId: initialScene.id,
            });
          }

          set({
            currentSession: config.sessionId,
            gameConfig: initialConfig as GameConfig,
            currentScene: initialScene,
            dialogueHistory: initialDialogue,
            isDialogueActive: false,
            isChoicePanelVisible: false,
            isInputPanelVisible: false,
            streamingText: '',
            isStreaming: false,
          });

          // Save initial state
          await get().saveGameState();
          console.log('[AVG] Created new game for session:', config.sessionId);
          
          if (loadResult.error) {
            console.warn('[AVG] Failed to load existing save:', loadResult.error);
          }
        }
      },

      setScene: (scene: SceneData) => {
        set({ currentScene: scene });
        // Auto-save when scene changes
        setTimeout(() => get().saveGameState(), 100);
      },

      addDialogue: (entry: DialogueEntry) => {
        set((state) => ({
          dialogueHistory: [...state.dialogueHistory, entry],
        }));
        // Auto-save when dialogue is added
        setTimeout(() => get().saveGameState(), 100);
      },

      setStreamingText: (text: string) => {
        set({ streamingText: text });
      },

      setStreaming: (isStreaming: boolean) => {
        set({ isStreaming });
        if (!isStreaming) {
          // Clear streaming text when done
          set({ streamingText: '' });
        }
      },

      setChoicePanelVisible: (visible: boolean) => {
        set({ isChoicePanelVisible: visible });
      },

      setInputPanelVisible: (visible: boolean) => {
        set({ isInputPanelVisible: visible });
      },

      saveGameState: async () => {
        const state = get();
        if (!state.currentSession || !state.gameConfig) {
          console.warn('[AVG] Cannot save: missing session or config');
          return false;
        }

        const saveResult = await avgSaveManager.saveGame(state.currentSession, state);
        if (saveResult.success) {
          console.log('[AVG] Game state saved for session:', state.currentSession);
          return true;
        } else {
          console.error('[AVG] Failed to save game state:', saveResult.error);
          return false;
        }
      },

      loadGameState: async (sessionId: string) => {
        const loadResult = await avgSaveManager.loadGame(sessionId);
        if (loadResult.success && loadResult.data) {
          set({
            currentSession: sessionId,
            gameConfig: loadResult.data.gameConfig,
            currentScene: loadResult.data.currentScene,
            dialogueHistory: loadResult.data.dialogueHistory,
            isDialogueActive: false,
            isChoicePanelVisible: false,
            isInputPanelVisible: false,
            streamingText: '',
            isStreaming: false,
          });
          console.log('[AVG] Loaded game state for session:', sessionId);
          return true;
        } else {
          console.error('[AVG] Failed to load game state:', loadResult.error);
          return false;
        }
      },

      clearSession: () => {
        set({
          currentSession: undefined,
          currentScene: DEFAULT_SCENE,
          dialogueHistory: [],
          gameConfig: undefined,
          isDialogueActive: false,
          isChoicePanelVisible: false,
          isInputPanelVisible: false,
          streamingText: '',
          isStreaming: false,
        });
      },

      deleteGameSave: async (sessionId: string) => {
        const deleteResult = await avgSaveManager.deleteGame(sessionId);
        if (deleteResult.success) {
          console.log('[AVG] Deleted save for session:', sessionId);
          
          // If we're deleting the current session, clear it
          const state = get();
          if (state.currentSession === sessionId) {
            get().clearSession();
          }
          return true;
        } else {
          console.error('[AVG] Failed to delete save:', deleteResult.error);
          return false;
        }
      },

      listGameSaves: async () => {
        const listResult = await avgSaveManager.listSaves();
        if (listResult.success) {
          return listResult.saves || [];
        } else {
          console.error('[AVG] Failed to list saves:', listResult.error);
          return [];
        }
      },

      saveExists: async (sessionId: string) => {
        return await avgSaveManager.saveExists(sessionId);
      },

      getSaveMetadata: async (sessionId: string) => {
        const metadataResult = await avgSaveManager.getSaveMetadata(sessionId);
        if (metadataResult.success && metadataResult.metadata) {
          return metadataResult.metadata;
        } else {
          console.error('[AVG] Failed to get save metadata:', metadataResult.error);
          return null;
        }
      },

      // Streaming actions
      startStreamingResponse: async (userInput: string) => {
        const state = get();
        if (!state.gameConfig) {
          console.error('[AVG] Cannot start streaming: no game config');
          return;
        }

        // Add user input to dialogue history
        const userEntry: DialogueEntry = {
          id: `user-${Date.now()}`,
          timestamp: Date.now(),
          speaker: state.gameConfig.userName,
          text: userInput,
          type: 'user',
          sceneId: state.currentScene.id,
        };
        get().addDialogue(userEntry);

        // Build dialogue context
        const context: DialogueContext = {
          characterName: state.gameConfig.characterName,
          userName: state.gameConfig.userName,
          systemPrompt: state.gameConfig.systemPrompt || '',
          recentHistory: state.dialogueHistory,
          currentScene: state.currentScene,
        };

        // Set up streaming state
        set({ 
          isStreaming: true, 
          streamingText: '',
          isDialogueActive: true,
          isChoicePanelVisible: false,
          isInputPanelVisible: false,
        });

        // Start streaming
        const callbacks: StreamCallbacks = {
          onToken: (token: string) => {
            set((state) => ({
              streamingText: state.streamingText + token,
            }));
          },
          onComplete: (fullText: string) => {
            // Add AI response to dialogue history
            const aiEntry: DialogueEntry = {
              id: `ai-${Date.now()}`,
              timestamp: Date.now(),
              speaker: state.gameConfig!.characterName,
              text: fullText,
              type: 'character',
              sceneId: state.currentScene.id,
            };
            get().addDialogue(aiEntry);

            // Update state
            set({
              isStreaming: false,
              streamingText: '',
              isDialogueActive: true,
            });

            console.log('[AVG] Streaming response completed');
          },
          onError: (error: Error) => {
            console.error('[AVG] Streaming error:', error);
            
            // Add error message to dialogue
            const errorEntry: DialogueEntry = {
              id: `error-${Date.now()}`,
              timestamp: Date.now(),
              speaker: 'System',
              text: '抱歉，发生了错误。请稍后再试。',
              type: 'system',
              sceneId: state.currentScene.id,
            };
            get().addDialogue(errorEntry);

            set({
              isStreaming: false,
              streamingText: '',
              isDialogueActive: true,
            });
          },
        };

        avgStreamingService.startStreaming(callbacks, (streamingState) => {
          set({
            isStreaming: streamingState.isStreaming,
            streamingText: streamingState.currentText,
          });
        });

        try {
          await avgAIService.streamResponse(context, userInput, callbacks);
        } catch (error) {
          console.error('[AVG] Failed to start streaming:', error);
          callbacks.onError(error as Error);
        }
      },

      stopStreaming: () => {
        avgStreamingService.stopStreaming();
        set({
          isStreaming: false,
          streamingText: '',
        });
      },

      interruptStreaming: () => {
        const interrupted = avgStreamingService.interruptStreaming();
        if (interrupted) {
          set({
            isStreaming: false,
          });
        }
        return interrupted;
      },
    }),
    {
      name: 'avg-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentSession: state.currentSession,
        // Don't persist UI state, only core game state
      }),
    },
  ),
);

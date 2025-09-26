import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { 
  AVGState, 
  GameConfig, 
  SceneData, 
  DialogueEntry, 
  GameSave,
  DEFAULT_SCENE,
  DEFAULT_GAME_CONFIG 
} from '../types/avg';

// AVG saves are stored in JSONL format under Expo's document directory
// File path: <documents>/st-mobile/avg-saves/<sessionId>.json

const ROOT_DIR = FileSystem.documentDirectory + 'st-mobile/';
const AVG_SAVES_DIR = ROOT_DIR + 'avg-saves/';

async function ensureDirs() {
  try { 
    await FileSystem.makeDirectoryAsync(AVG_SAVES_DIR, { intermediates: true }); 
  } catch {}
}

async function saveGameToDisk(sessionId: string, gameState: Partial<AVGState>) {
  await ensureDirs();
  const filePath = `${AVG_SAVES_DIR}${encodeURIComponent(sessionId)}.json`;
  
  const saveData: GameSave = {
    id: sessionId,
    title: `${gameState.gameConfig?.characterName || 'AVG'} - ${new Date().toLocaleDateString()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gameConfig: gameState.gameConfig!,
    currentScene: gameState.currentScene!,
    dialogueHistory: gameState.dialogueHistory || [],
    gameVariables: {}, // Reserved for future use
  };
  
  await FileSystem.writeAsStringAsync(
    filePath, 
    JSON.stringify(saveData, null, 2), 
    { encoding: FileSystem.EncodingType.UTF8 }
  );
}

async function loadGameFromDisk(sessionId: string): Promise<GameSave | null> {
  try {
    const filePath = `${AVG_SAVES_DIR}${encodeURIComponent(sessionId)}.json`;
    const data = await FileSystem.readAsStringAsync(filePath, { 
      encoding: FileSystem.EncodingType.UTF8 
    });
    return JSON.parse(data) as GameSave;
  } catch {
    return null;
  }
}

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
        const existingSave = await loadGameFromDisk(config.sessionId);
        
        if (existingSave) {
          // Load from existing save
          set({
            currentSession: config.sessionId,
            gameConfig: existingSave.gameConfig,
            currentScene: existingSave.currentScene,
            dialogueHistory: existingSave.dialogueHistory,
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
        }
      },
      
      setScene: (scene: SceneData) => {
        set({ currentScene: scene });
        // Auto-save when scene changes
        setTimeout(() => get().saveGameState(), 100);
      },
      
      addDialogue: (entry: DialogueEntry) => {
        set((state) => ({
          dialogueHistory: [...state.dialogueHistory, entry]
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
          return;
        }
        
        try {
          await saveGameToDisk(state.currentSession, state);
          console.log('[AVG] Game state saved for session:', state.currentSession);
        } catch (error) {
          console.error('[AVG] Failed to save game state:', error);
        }
      },
      
      loadGameState: async (sessionId: string) => {
        try {
          const saveData = await loadGameFromDisk(sessionId);
          if (saveData) {
            set({
              currentSession: sessionId,
              gameConfig: saveData.gameConfig,
              currentScene: saveData.currentScene,
              dialogueHistory: saveData.dialogueHistory,
              isDialogueActive: false,
              isChoicePanelVisible: false,
              isInputPanelVisible: false,
              streamingText: '',
              isStreaming: false,
            });
            console.log('[AVG] Loaded game state for session:', sessionId);
          } else {
            console.warn('[AVG] No save found for session:', sessionId);
          }
        } catch (error) {
          console.error('[AVG] Failed to load game state:', error);
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
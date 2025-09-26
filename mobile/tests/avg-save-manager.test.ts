import { AVGSaveManager } from '../src/services/avg-save-manager';
import { GameConfig, SceneData, DEFAULT_SCENE, DEFAULT_GAME_CONFIG } from '../src/types/avg';

// Mock dependencies
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/documents/',
  makeDirectoryAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  EncodingType: {
    UTF8: 'utf8',
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('AVGSaveManager', () => {
  let saveManager: AVGSaveManager;
  const mockSessionId = 'test-session-123';
  const mockGameState = {
    gameConfig: {
      sessionId: mockSessionId,
      characterName: 'Test Character',
      userName: 'Test User',
      initialScene: 'default',
      systemPrompt: 'Test system prompt',
    } as GameConfig,
    currentScene: DEFAULT_SCENE,
    dialogueHistory: [
      {
        id: 'test-dialogue-1',
        timestamp: Date.now(),
        speaker: 'Test Character',
        text: 'Hello, test!',
        type: 'character' as const,
        sceneId: 'default',
      },
    ],
  };

  beforeEach(() => {
    saveManager = AVGSaveManager.getInstance();
    jest.clearAllMocks();
  });

  describe('saveGame', () => {
    it('should save game successfully to file system', async () => {
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const result = await saveManager.saveGame(mockSessionId, mockGameState);

      expect(result.success).toBe(true);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalled(); // Backup
    });

    it('should fallback to AsyncStorage if file system fails', async () => {
      (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(new Error('File system error'));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const result = await saveManager.saveGame(mockSessionId, mockGameState);

      expect(result.success).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should fail if both file system and AsyncStorage fail', async () => {
      (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(new Error('File system error'));
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('AsyncStorage error'));

      const result = await saveManager.saveGame(mockSessionId, mockGameState);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('file_system');
    });

    it('should validate game state before saving', async () => {
      const invalidGameState = {
        gameConfig: undefined,
        currentScene: undefined,
      };

      const result = await saveManager.saveGame(mockSessionId, invalidGameState);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
    });
  });

  describe('loadGame', () => {
    const mockSaveData = {
      id: mockSessionId,
      title: 'Test Save',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      gameConfig: mockGameState.gameConfig,
      currentScene: mockGameState.currentScene,
      dialogueHistory: mockGameState.dialogueHistory,
      gameVariables: {},
      version: '1.0.0',
    };

    it('should load game successfully from file system', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify(mockSaveData));

      const result = await saveManager.loadGame(mockSessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSaveData);
    });

    it('should fallback to AsyncStorage if file system fails', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('File not found'));
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockSaveData));
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined); // For restore

      const result = await saveManager.loadGame(mockSessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSaveData);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled(); // Should restore to file system
    });

    it('should fail if no save data exists', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('File not found'));
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await saveManager.loadGame(mockSessionId);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('file_system');
    });

    it('should fail if save data is corrupted', async () => {
      const corruptedData = { invalid: 'data' };
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify(corruptedData));
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(corruptedData));

      const result = await saveManager.loadGame(mockSessionId);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('corruption');
    });
  });

  describe('deleteGame', () => {
    it('should delete game from both file system and AsyncStorage', async () => {
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const result = await saveManager.deleteGame(mockSessionId);

      expect(result.success).toBe(true);
      expect(FileSystem.deleteAsync).toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('should succeed if at least one deletion succeeds', async () => {
      (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(new Error('File system error'));
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const result = await saveManager.deleteGame(mockSessionId);

      expect(result.success).toBe(true);
    });

    it('should fail if both deletions fail', async () => {
      (FileSystem.deleteAsync as jest.Mock).mockRejectedValue(new Error('File system error'));
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('AsyncStorage error'));

      const result = await saveManager.deleteGame(mockSessionId);

      expect(result.success).toBe(false);
    });
  });

  describe('listSaves', () => {
    it('should list all valid save files', async () => {
      const mockFiles = ['test-session-1.json', 'test-session-2.json', 'invalid.txt'];
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue(mockFiles);
      
      // Mock successful loads for valid files
      (FileSystem.readAsStringAsync as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({ ...mockSaveData, id: 'test-session-1' }))
        .mockResolvedValueOnce(JSON.stringify({ ...mockSaveData, id: 'test-session-2' }));

      const result = await saveManager.listSaves();

      expect(result.success).toBe(true);
      expect(result.saves).toHaveLength(2);
      expect(result.saves![0].id).toBe('test-session-2'); // Should be sorted by updatedAt
    });
  });

  describe('saveExists', () => {
    it('should return true if file exists', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

      const exists = await saveManager.saveExists(mockSessionId);

      expect(exists).toBe(true);
    });

    it('should check AsyncStorage if file does not exist', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('some data');

      const exists = await saveManager.saveExists(mockSessionId);

      expect(exists).toBe(true);
    });

    it('should return false if neither exists', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const exists = await saveManager.saveExists(mockSessionId);

      expect(exists).toBe(false);
    });
  });
});
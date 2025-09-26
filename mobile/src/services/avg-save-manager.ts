import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameSave, AVGState } from '../types/avg';

// AVG saves are stored in JSONL format under Expo's document directory
// File path: <documents>/st-mobile/avg-saves/<sessionId>.json
// Backup saves are stored in AsyncStorage with key: avg-backup-<sessionId>

const ROOT_DIR = FileSystem.documentDirectory + 'st-mobile/';
const AVG_SAVES_DIR = ROOT_DIR + 'avg-saves/';
const BACKUP_KEY_PREFIX = 'avg-backup-';
const SAVE_VERSION = '1.0.0';

export interface SaveManagerError {
  type: 'file_system' | 'async_storage' | 'validation' | 'corruption';
  message: string;
  originalError?: Error;
}

export class AVGSaveManager {
  private static instance: AVGSaveManager;

  static getInstance(): AVGSaveManager {
    if (!AVGSaveManager.instance) {
      AVGSaveManager.instance = new AVGSaveManager();
    }
    return AVGSaveManager.instance;
  }

  private constructor() {}

  /**
   * Ensure save directories exist
   */
  private async ensureDirs(): Promise<void> {
    try {
      await FileSystem.makeDirectoryAsync(AVG_SAVES_DIR, { intermediates: true });
    } catch (error) {
      // Directory might already exist, ignore error
      console.log('[SaveManager] Directory creation result:', error);
    }
  }

  /**
   * Generate file path for a session
   */
  private getFilePath(sessionId: string): string {
    return `${AVG_SAVES_DIR}${encodeURIComponent(sessionId)}.json`;
  }

  /**
   * Generate backup key for AsyncStorage
   */
  private getBackupKey(sessionId: string): string {
    return `${BACKUP_KEY_PREFIX}${sessionId}`;
  }

  /**
   * Validate save data integrity
   */
  private validateSaveData(data: any): data is GameSave {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const required = ['id', 'title', 'createdAt', 'updatedAt', 'gameConfig', 'currentScene', 'dialogueHistory'];
    for (const field of required) {
      if (!(field in data)) {
        console.warn(`[SaveManager] Missing required field: ${field}`);
        return false;
      }
    }

    // Validate gameConfig structure
    const config = data.gameConfig;
    if (!config || !config.sessionId || !config.characterName || !config.userName) {
      console.warn('[SaveManager] Invalid gameConfig structure');
      return false;
    }

    // Validate currentScene structure
    const scene = data.currentScene;
    if (!scene || !scene.id || !scene.backgroundImage) {
      console.warn('[SaveManager] Invalid currentScene structure');
      return false;
    }

    // Validate dialogueHistory is array
    if (!Array.isArray(data.dialogueHistory)) {
      console.warn('[SaveManager] dialogueHistory is not an array');
      return false;
    }

    return true;
  }

  /**
   * Create save data from game state
   */
  private createSaveData(sessionId: string, gameState: Partial<AVGState>): GameSave {
    const now = new Date().toISOString();
    
    return {
      id: sessionId,
      title: `${gameState.gameConfig?.characterName || 'AVG'} - ${new Date().toLocaleDateString()}`,
      createdAt: gameState.gameConfig ? now : now, // Use current time for new saves
      updatedAt: now,
      gameConfig: gameState.gameConfig!,
      currentScene: gameState.currentScene!,
      dialogueHistory: gameState.dialogueHistory || [],
      gameVariables: {}, // Reserved for future use
      version: SAVE_VERSION, // Add version for future compatibility
    } as GameSave;
  }

  /**
   * Save game state to file system with backup to AsyncStorage
   */
  async saveGame(sessionId: string, gameState: Partial<AVGState>): Promise<{ success: boolean; error?: SaveManagerError }> {
    if (!gameState.gameConfig || !gameState.currentScene) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Missing required game state (gameConfig or currentScene)',
        },
      };
    }

    const saveData = this.createSaveData(sessionId, gameState);

    // Validate the save data before saving
    if (!this.validateSaveData(saveData)) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'Generated save data failed validation',
        },
      };
    }

    try {
      await this.ensureDirs();
      const filePath = this.getFilePath(sessionId);
      const jsonData = JSON.stringify(saveData, null, 2);

      // Primary save to file system
      await FileSystem.writeAsStringAsync(filePath, jsonData, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Backup save to AsyncStorage
      try {
        await AsyncStorage.setItem(this.getBackupKey(sessionId), jsonData);
      } catch (backupError) {
        console.warn('[SaveManager] Backup to AsyncStorage failed:', backupError);
        // Don't fail the entire operation if backup fails
      }

      console.log('[SaveManager] Game saved successfully for session:', sessionId);
      return { success: true };

    } catch (error) {
      console.error('[SaveManager] Failed to save to file system:', error);

      // Try to save to AsyncStorage as fallback
      try {
        const jsonData = JSON.stringify(saveData, null, 2);
        await AsyncStorage.setItem(this.getBackupKey(sessionId), jsonData);
        console.log('[SaveManager] Saved to AsyncStorage as fallback');
        return { success: true };
      } catch (fallbackError) {
        console.error('[SaveManager] Fallback save also failed:', fallbackError);
        return {
          success: false,
          error: {
            type: 'file_system',
            message: 'Failed to save to both file system and AsyncStorage',
            originalError: error as Error,
          },
        };
      }
    }
  }

  /**
   * Load game state from file system with AsyncStorage fallback
   */
  async loadGame(sessionId: string): Promise<{ success: boolean; data?: GameSave; error?: SaveManagerError }> {
    try {
      // Try to load from file system first
      const filePath = this.getFilePath(sessionId);
      const fileData = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsedData = JSON.parse(fileData);
      
      if (this.validateSaveData(parsedData)) {
        console.log('[SaveManager] Loaded from file system for session:', sessionId);
        return { success: true, data: parsedData };
      } else {
        console.warn('[SaveManager] File system data failed validation, trying backup');
        throw new Error('File system data validation failed');
      }

    } catch (fileError) {
      console.warn('[SaveManager] Failed to load from file system:', fileError);

      // Try to load from AsyncStorage backup
      try {
        const backupData = await AsyncStorage.getItem(this.getBackupKey(sessionId));
        if (!backupData) {
          return {
            success: false,
            error: {
              type: 'file_system',
              message: 'No save data found in file system or backup',
            },
          };
        }

        const parsedBackupData = JSON.parse(backupData);
        
        if (this.validateSaveData(parsedBackupData)) {
          console.log('[SaveManager] Loaded from AsyncStorage backup for session:', sessionId);
          
          // Try to restore to file system
          try {
            await this.ensureDirs();
            const filePath = this.getFilePath(sessionId);
            await FileSystem.writeAsStringAsync(filePath, backupData, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            console.log('[SaveManager] Restored backup to file system');
          } catch (restoreError) {
            console.warn('[SaveManager] Failed to restore backup to file system:', restoreError);
          }

          return { success: true, data: parsedBackupData };
        } else {
          return {
            success: false,
            error: {
              type: 'corruption',
              message: 'Both primary and backup save data are corrupted',
            },
          };
        }

      } catch (backupError) {
        console.error('[SaveManager] Failed to load from backup:', backupError);
        return {
          success: false,
          error: {
            type: 'async_storage',
            message: 'Failed to load from both file system and AsyncStorage',
            originalError: backupError as Error,
          },
        };
      }
    }
  }

  /**
   * Delete game save from both file system and AsyncStorage
   */
  async deleteGame(sessionId: string): Promise<{ success: boolean; error?: SaveManagerError }> {
    let fileSystemSuccess = false;
    let asyncStorageSuccess = false;
    let lastError: Error | undefined;

    // Delete from file system
    try {
      const filePath = this.getFilePath(sessionId);
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      fileSystemSuccess = true;
      console.log('[SaveManager] Deleted from file system for session:', sessionId);
    } catch (error) {
      console.warn('[SaveManager] Failed to delete from file system:', error);
      lastError = error as Error;
    }

    // Delete from AsyncStorage
    try {
      await AsyncStorage.removeItem(this.getBackupKey(sessionId));
      asyncStorageSuccess = true;
      console.log('[SaveManager] Deleted from AsyncStorage for session:', sessionId);
    } catch (error) {
      console.warn('[SaveManager] Failed to delete from AsyncStorage:', error);
      lastError = error as Error;
    }

    if (fileSystemSuccess || asyncStorageSuccess) {
      return { success: true };
    } else {
      return {
        success: false,
        error: {
          type: 'file_system',
          message: 'Failed to delete from both file system and AsyncStorage',
          originalError: lastError,
        },
      };
    }
  }

  /**
   * List all available save files
   */
  async listSaves(): Promise<{ success: boolean; saves?: GameSave[]; error?: SaveManagerError }> {
    try {
      await this.ensureDirs();
      const files = await FileSystem.readDirectoryAsync(AVG_SAVES_DIR);
      const saves: GameSave[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const sessionId = decodeURIComponent(file.replace('.json', ''));
            const loadResult = await this.loadGame(sessionId);
            if (loadResult.success && loadResult.data) {
              saves.push(loadResult.data);
            }
          } catch (error) {
            console.warn(`[SaveManager] Failed to load save file ${file}:`, error);
          }
        }
      }

      // Sort by updatedAt descending (most recent first)
      saves.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return { success: true, saves };

    } catch (error) {
      console.error('[SaveManager] Failed to list saves:', error);
      return {
        success: false,
        error: {
          type: 'file_system',
          message: 'Failed to list save files',
          originalError: error as Error,
        },
      };
    }
  }

  /**
   * Check if a save exists for the given session
   */
  async saveExists(sessionId: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(sessionId);
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        return true;
      }

      // Check backup
      const backupData = await AsyncStorage.getItem(this.getBackupKey(sessionId));
      return backupData !== null;

    } catch (error) {
      console.warn('[SaveManager] Error checking save existence:', error);
      return false;
    }
  }

  /**
   * Get save metadata without loading full save data
   */
  async getSaveMetadata(sessionId: string): Promise<{ success: boolean; metadata?: Partial<GameSave>; error?: SaveManagerError }> {
    try {
      const loadResult = await this.loadGame(sessionId);
      if (loadResult.success && loadResult.data) {
        const { dialogueHistory, gameVariables, ...metadata } = loadResult.data;
        return { success: true, metadata };
      } else {
        return { success: false, error: loadResult.error };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'file_system',
          message: 'Failed to get save metadata',
          originalError: error as Error,
        },
      };
    }
  }
}

// Export singleton instance
export const avgSaveManager = AVGSaveManager.getInstance();
import { avgAssetService } from './avg-assets';
import { GameConfig, SceneData } from '../types/avg';

export interface PreloadProgress {
  current: number;
  total: number;
  currentAsset: string;
  percentage: number;
}

export interface PreloadResult {
  success: boolean;
  error?: string;
  loadedAssets: string[];
  failedAssets: string[];
}

/**
 * Service for preloading game assets during initialization
 */
class AVGPreloaderService {
  private isPreloading = false;
  private preloadPromise: Promise<PreloadResult> | null = null;

  /**
   * Preload essential game assets
   */
  async preloadGameAssets(
    config: GameConfig,
    scene: SceneData,
    onProgress?: (progress: PreloadProgress) => void
  ): Promise<PreloadResult> {
    if (this.isPreloading && this.preloadPromise) {
      return this.preloadPromise;
    }

    this.isPreloading = true;
    this.preloadPromise = this.performPreload(config, scene, onProgress);

    try {
      const result = await this.preloadPromise;
      return result;
    } finally {
      this.isPreloading = false;
      this.preloadPromise = null;
    }
  }

  private async performPreload(
    config: GameConfig,
    scene: SceneData,
    onProgress?: (progress: PreloadProgress) => void
  ): Promise<PreloadResult> {
    const assetsToLoad: string[] = [];
    const loadedAssets: string[] = [];
    const failedAssets: string[] = [];

    // Collect assets to preload
    if (scene.backgroundImage) {
      assetsToLoad.push(scene.backgroundImage);
    }

    if (scene.character?.image) {
      assetsToLoad.push(scene.character.image);
    }

    // Add default assets
    const defaultAssets = await this.getDefaultAssets();
    assetsToLoad.push(...defaultAssets);

    console.log('[AVGPreloader] Starting preload of', assetsToLoad.length, 'assets');

    const total = assetsToLoad.length;
    let current = 0;

    for (const assetPath of assetsToLoad) {
      try {
        onProgress?.({
          current,
          total,
          currentAsset: assetPath,
          percentage: Math.round((current / total) * 100),
        });

        console.log(`[AVGPreloader] Loading asset ${current + 1}/${total}: ${assetPath}`);

        // Attempt to load the asset
        const loadResult = await avgAssetService.loadAsset(assetPath);
        
        if (loadResult.success) {
          loadedAssets.push(assetPath);
          console.log(`[AVGPreloader] Successfully loaded: ${assetPath}`);
        } else {
          failedAssets.push(assetPath);
          console.warn(`[AVGPreloader] Failed to load: ${assetPath}`, loadResult.error);
        }
      } catch (error) {
        failedAssets.push(assetPath);
        console.error(`[AVGPreloader] Error loading asset: ${assetPath}`, error);
      }

      current++;
    }

    // Final progress update
    onProgress?.({
      current: total,
      total,
      currentAsset: '',
      percentage: 100,
    });

    const success = failedAssets.length === 0;
    const result: PreloadResult = {
      success,
      loadedAssets,
      failedAssets,
    };

    if (!success) {
      result.error = `Failed to load ${failedAssets.length} assets: ${failedAssets.join(', ')}`;
    }

    console.log('[AVGPreloader] Preload completed:', result);
    return result;
  }

  /**
   * Get list of default assets that should always be preloaded
   */
  private async getDefaultAssets(): Promise<string[]> {
    return [
      // Default background (if exists)
      'assets/backgrounds/default.jpg',
      // Default character sprites (if exist)
      'assets/characters/default/neutral.png',
      // UI assets
      'assets/ui/dialogue-box-bg.png',
      'assets/ui/choice-button-bg.png',
    ].filter(Boolean);
  }

  /**
   * Validate game configuration
   */
  validateGameConfig(config: Partial<GameConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!config.sessionId) {
      errors.push('Session ID is required');
    }

    if (!config.characterName) {
      errors.push('Character name is required');
    }

    if (!config.userName) {
      errors.push('User name is required');
    }

    // Validate session ID format
    if (config.sessionId && !/^[a-zA-Z0-9-_]+$/.test(config.sessionId)) {
      errors.push('Session ID contains invalid characters');
    }

    // Validate names
    if (config.characterName && config.characterName.length > 50) {
      errors.push('Character name is too long (max 50 characters)');
    }

    if (config.userName && config.userName.length > 50) {
      errors.push('User name is too long (max 50 characters)');
    }

    // Validate system prompt
    if (config.systemPrompt && config.systemPrompt.length > 2000) {
      errors.push('System prompt is too long (max 2000 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create default scene configuration
   */
  createDefaultScene(config: GameConfig): SceneData {
    return {
      id: 'default-scene',
      name: '默认场景',
      backgroundImage: 'assets/backgrounds/default.jpg',
      character: {
        name: config.characterName,
        image: 'assets/characters/default/neutral.png',
        position: { x: 0.5, y: 0.8, scale: 1.0 },
        expression: 'neutral',
      },
      music: undefined,
      soundEffects: [],
      metadata: {
        description: '游戏的默认场景',
        tags: ['default', 'initial'],
      },
    };
  }

  /**
   * Initialize game with proper error handling and validation
   */
  async initializeGame(config: Partial<GameConfig>): Promise<{
    success: boolean;
    config?: GameConfig;
    scene?: SceneData;
    error?: string;
  }> {
    try {
      console.log('[AVGPreloader] Initializing game with config:', config);

      // Validate configuration
      const validation = this.validateGameConfig(config);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Configuration validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Create complete configuration with defaults
      const completeConfig: GameConfig = {
        sessionId: config.sessionId!,
        characterName: config.characterName!,
        userName: config.userName!,
        initialScene: config.initialScene || 'default',
        systemPrompt: config.systemPrompt || this.getDefaultSystemPrompt(config.characterName!),
      };

      // Create default scene
      const defaultScene = this.createDefaultScene(completeConfig);

      console.log('[AVGPreloader] Game initialization completed successfully');

      return {
        success: true,
        config: completeConfig,
        scene: defaultScene,
      };
    } catch (error) {
      console.error('[AVGPreloader] Game initialization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown initialization error',
      };
    }
  }

  /**
   * Get default system prompt for character
   */
  private getDefaultSystemPrompt(characterName: string): string {
    return `你是${characterName}，一个友善且有趣的AI角色。你正在与用户进行AVG风格的互动对话。

请遵循以下指导原则：
1. 保持角色的一致性和个性
2. 使用自然、生动的对话风格
3. 适时提供选择选项来推进对话
4. 创造有趣且引人入胜的故事情节
5. 根据用户的回应调整对话方向

记住，这是一个互动故事体验，你的目标是让用户享受这个过程。`;
  }

  /**
   * Check if preloading is currently in progress
   */
  isPreloadingInProgress(): boolean {
    return this.isPreloading;
  }
}

export const avgPreloaderService = new AVGPreloaderService();
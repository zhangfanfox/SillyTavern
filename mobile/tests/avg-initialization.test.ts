import { avgPreloaderService } from '../src/services/avg-preloader';
import { GameConfig } from '../src/types/avg';

describe('AVG Game Initialization', () => {
  beforeEach(() => {
    // Reset any state before each test
  });

  describe('Configuration Validation', () => {
    it('should validate valid game configuration', () => {
      const config: Partial<GameConfig> = {
        sessionId: 'test-session-123',
        characterName: 'TestCharacter',
        userName: 'TestUser',
        systemPrompt: 'Test system prompt',
      };

      const result = avgPreloaderService.validateGameConfig(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject configuration with missing required fields', () => {
      const config: Partial<GameConfig> = {
        sessionId: 'test-session-123',
        // Missing characterName and userName
      };

      const result = avgPreloaderService.validateGameConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Character name is required');
      expect(result.errors).toContain('User name is required');
    });

    it('should reject configuration with invalid session ID', () => {
      const config: Partial<GameConfig> = {
        sessionId: 'invalid session id!', // Contains spaces and special chars
        characterName: 'TestCharacter',
        userName: 'TestUser',
      };

      const result = avgPreloaderService.validateGameConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Session ID contains invalid characters');
    });

    it('should reject configuration with names that are too long', () => {
      const longName = 'a'.repeat(51); // 51 characters
      const config: Partial<GameConfig> = {
        sessionId: 'test-session-123',
        characterName: longName,
        userName: longName,
      };

      const result = avgPreloaderService.validateGameConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Character name is too long (max 50 characters)');
      expect(result.errors).toContain('User name is too long (max 50 characters)');
    });

    it('should reject configuration with system prompt that is too long', () => {
      const longPrompt = 'a'.repeat(2001); // 2001 characters
      const config: Partial<GameConfig> = {
        sessionId: 'test-session-123',
        characterName: 'TestCharacter',
        userName: 'TestUser',
        systemPrompt: longPrompt,
      };

      const result = avgPreloaderService.validateGameConfig(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('System prompt is too long (max 2000 characters)');
    });
  });

  describe('Game Initialization', () => {
    it('should initialize game with valid configuration', async () => {
      const config: Partial<GameConfig> = {
        sessionId: 'test-session-123',
        characterName: 'TestCharacter',
        userName: 'TestUser',
      };

      const result = await avgPreloaderService.initializeGame(config);
      
      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.scene).toBeDefined();
      expect(result.error).toBeUndefined();

      // Check that defaults are applied
      expect(result.config!.systemPrompt).toBeDefined();
      expect(result.config!.initialScene).toBe('default');
      
      // Check scene structure
      expect(result.scene!.id).toBe('default-scene');
      expect(result.scene!.name).toBe('默认场景');
      expect(result.scene!.character).toBeDefined();
      expect(result.scene!.character!.name).toBe('TestCharacter');
    });

    it('should fail initialization with invalid configuration', async () => {
      const config: Partial<GameConfig> = {
        // Missing required fields
      };

      const result = await avgPreloaderService.initializeGame(config);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.config).toBeUndefined();
      expect(result.scene).toBeUndefined();
    });
  });

  describe('Default Scene Creation', () => {
    it('should create default scene with proper structure', () => {
      const config: GameConfig = {
        sessionId: 'test-session-123',
        characterName: 'TestCharacter',
        userName: 'TestUser',
        initialScene: 'default',
        systemPrompt: 'Test prompt',
      };

      const scene = avgPreloaderService.createDefaultScene(config);
      
      expect(scene.id).toBe('default-scene');
      expect(scene.name).toBe('默认场景');
      expect(scene.backgroundImage).toBe('assets/backgrounds/default.jpg');
      expect(scene.character).toBeDefined();
      expect(scene.character!.name).toBe('TestCharacter');
      expect(scene.character!.image).toBe('assets/characters/default/neutral.png');
      expect(scene.character!.position).toEqual({ x: 0.5, y: 0.8, scale: 1.0 });
      expect(scene.character!.expression).toBe('neutral');
      expect(scene.metadata).toBeDefined();
      expect(scene.metadata!.description).toBe('游戏的默认场景');
      expect(scene.metadata!.tags).toContain('default');
      expect(scene.metadata!.tags).toContain('initial');
    });
  });

  describe('Preload Progress', () => {
    it('should not be preloading initially', () => {
      expect(avgPreloaderService.isPreloadingInProgress()).toBe(false);
    });
  });
});
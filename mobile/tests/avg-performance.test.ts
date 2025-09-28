import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { avgAssetService, AVGAssetService } from '../src/services/avg-assets';
import { avgCanvasService } from '../src/services/avg-canvas';

// Mock dependencies
vi.mock('expo-network', () => ({
  getNetworkStateAsync: vi.fn().mockResolvedValue({ isConnected: true }),
}));

vi.mock('expo-file-system', () => ({
  getInfoAsync: vi.fn().mockResolvedValue({ exists: true }),
}));

describe('AVG Performance Optimizations', () => {
  let assetService: AVGAssetService;

  beforeEach(() => {
    assetService = new AVGAssetService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    assetService.clearCache();
  });

  describe('Asset Loading Performance', () => {
    it('should cache loaded assets to avoid redundant loading', async () => {
      const testPath = 'assets/avg/test-background.png';
      
      // First load
      const result1 = await assetService.loadBackgroundImage(testPath);
      expect(result1.success).toBe(true);
      
      // Second load should use cache
      const result2 = await assetService.loadBackgroundImage(testPath);
      expect(result2.success).toBe(true);
      expect(result2.retryCount).toBe(0); // Should be from cache
      
      // Verify cache statistics
      const stats = assetService.getCacheStats();
      expect(stats.cached).toBe(1);
    });

    it('should implement LRU cache eviction when cache is full', async () => {
      // Set a small cache size for testing
      const smallCacheService = new AVGAssetService();
      (smallCacheService as any).maxCacheSize = 2;
      
      // Load assets to fill cache
      await smallCacheService.loadBackgroundImage('assets/test1.png');
      await smallCacheService.loadBackgroundImage('assets/test2.png');
      
      let stats = smallCacheService.getCacheStats();
      expect(stats.cached).toBe(2);
      
      // Load third asset should trigger eviction
      await smallCacheService.loadBackgroundImage('assets/test3.png');
      
      stats = smallCacheService.getCacheStats();
      expect(stats.cached).toBeLessThanOrEqual(2);
    });

    it('should handle concurrent loading requests efficiently', async () => {
      const testPath = 'assets/avg/concurrent-test.png';
      
      // Start multiple concurrent loads
      const promises = Array(5).fill(null).map(() => 
        assetService.loadBackgroundImage(testPath)
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Should only have one cached entry
      const stats = assetService.getCacheStats();
      expect(stats.cached).toBe(1);
    });
  });

  describe('Error Handling Performance', () => {
    it('should implement exponential backoff for retries', async () => {
      const startTime = Date.now();
      
      // Mock a failing asset
      const failingPath = 'http://nonexistent.example.com/image.png';
      
      const result = await assetService.loadBackgroundImage(failingPath, {
        maxRetries: 2,
        retryDelay: 100,
        backoffMultiplier: 2,
        timeoutMs: 1000,
      });
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should have taken at least the retry delays (100ms + 200ms)
      expect(elapsed).toBeGreaterThan(250);
      expect(result.success).toBe(false);
      expect(result.retryCount).toBeGreaterThan(0);
    });

    it('should not retry non-retryable errors', async () => {
      const startTime = Date.now();
      
      // Mock a file not found error (non-retryable)
      const invalidPath = 'assets/nonexistent-file.png';
      
      const result = await assetService.loadBackgroundImage(invalidPath);
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should fail quickly without retries
      expect(elapsed).toBeLessThan(1000);
      expect(result.success).toBe(false);
      expect(result.error?.canRetry).toBe(false);
    });

    it('should track failed assets for retry management', async () => {
      const failingPath = 'http://nonexistent.example.com/image.png';
      
      await assetService.loadBackgroundImage(failingPath);
      
      const failedAssets = assetService.getFailedAssets();
      expect(failedAssets).toContain(failingPath);
      
      // Retry should clear from failed list on success
      // (In a real scenario, this would succeed after network recovery)
    });
  });

  describe('Memory Management', () => {
    it('should provide cache statistics for monitoring', () => {
      const stats = assetService.getCacheStats();
      
      expect(stats).toHaveProperty('cached');
      expect(stats).toHaveProperty('loading');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('totalRetryAttempts');
      
      expect(typeof stats.cached).toBe('number');
      expect(typeof stats.loading).toBe('number');
      expect(typeof stats.failed).toBe('number');
      expect(typeof stats.totalRetryAttempts).toBe('number');
    });

    it('should provide asset status information', async () => {
      const testPath = 'assets/avg/status-test.png';
      
      // Initially should not be cached
      let status = assetService.getAssetStatus(testPath);
      expect(status.isCached).toBe(false);
      expect(status.isLoading).toBe(false);
      expect(status.hasFailed).toBe(false);
      expect(status.retryCount).toBe(0);
      
      // After loading should be cached
      await assetService.loadBackgroundImage(testPath);
      
      status = assetService.getAssetStatus(testPath);
      expect(status.isCached).toBe(true);
    });

    it('should clear all caches and state when requested', async () => {
      // Load some assets
      await assetService.loadBackgroundImage('assets/test1.png');
      await assetService.loadCharacterImage('assets/test2.png');
      
      let stats = assetService.getCacheStats();
      expect(stats.cached).toBeGreaterThan(0);
      
      // Clear cache
      assetService.clearCache();
      
      stats = assetService.getCacheStats();
      expect(stats.cached).toBe(0);
      expect(stats.loading).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.totalRetryAttempts).toBe(0);
    });
  });

  describe('Network Optimization', () => {
    it('should check network status before loading remote assets', async () => {
      const networkPath = 'https://example.com/image.png';
      
      // Mock network check
      const { getNetworkStateAsync } = await import('expo-network');
      vi.mocked(getNetworkStateAsync).mockResolvedValueOnce({ isConnected: false } as any);
      
      const result = await assetService.loadBackgroundImage(networkPath);
      
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('network');
    });

    it('should validate URL format for remote assets', async () => {
      const invalidUrl = 'ftp://invalid-protocol.com/image.png';
      
      const result = await assetService.loadBackgroundImage(invalidUrl);
      
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('invalid_format');
    });
  });

  describe('Canvas Service Performance', () => {
    it('should handle failed asset loading gracefully', async () => {
      const mockCanvasRef = { current: { postMessage: vi.fn() } };
      avgCanvasService.setCanvasRef(mockCanvasRef as any);
      avgCanvasService.setReady();
      
      const result = await avgCanvasService.loadBackground('nonexistent.png');
      
      expect(result.success).toBe(false);
      expect(result.isPlaceholder).toBe(true);
    });

    it('should provide retry functionality for failed assets', async () => {
      const mockCanvasRef = { current: { postMessage: vi.fn() } };
      avgCanvasService.setCanvasRef(mockCanvasRef as any);
      avgCanvasService.setReady();
      
      const failedPath = 'failed-asset.png';
      
      // Initial load fails
      await avgCanvasService.loadBackground(failedPath);
      
      // Retry should attempt to load again
      const retryResult = await avgCanvasService.retryBackground(failedPath);
      
      expect(retryResult).toBeDefined();
      expect(typeof retryResult.success).toBe('boolean');
    });

    it('should track network status for connectivity-aware loading', async () => {
      const isConnected = await avgCanvasService.checkNetworkStatus();
      expect(typeof isConnected).toBe('boolean');
    });
  });
});
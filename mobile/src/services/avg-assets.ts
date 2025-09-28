import { Buffer } from 'buffer';
import { Buffer } from 'buffer';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';

export interface AssetInfo {
  uri: string;
  width?: number;
  height?: number;
  type: 'background' | 'character';
  isPlaceholder?: boolean;
}

export interface AssetLoadResult {
  success: boolean;
  asset?: AssetInfo;
  error?: AssetError;
  retryCount?: number;
}

export interface AssetError {
  type: 'network' | 'file_not_found' | 'invalid_format' | 'timeout' | 'unknown';
  message: string;
  originalPath: string;
  canRetry: boolean;
}

export interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

export interface AssetLoader {
  loadBackgroundImage(path: string, options?: Partial<RetryOptions>): Promise<AssetLoadResult>;
  loadCharacterImage(path: string, options?: Partial<RetryOptions>): Promise<AssetLoadResult>;
  preloadAssets(paths: string[], options?: Partial<RetryOptions>): Promise<AssetLoadResult[]>;
  retryFailedAsset(path: string, type: 'background' | 'character'): Promise<AssetLoadResult>;
  getPlaceholderBackground(): AssetInfo;
  getPlaceholderCharacter(): AssetInfo;
  clearCache(): void;
  getFailedAssets(): string[];
  checkNetworkStatus(): Promise<boolean>;
}

export class AVGAssetService implements AssetLoader {
  private imageCache = new Map<string, AssetInfo>();
  private loadingPromises = new Map<string, Promise<AssetLoadResult>>();
  private failedAssets = new Set<string>();
  private retryAttempts = new Map<string, number>();
  private cacheAccessTimes = new Map<string, number>();
  
  private maxCacheSize = 20;
  
  private defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    timeoutMs: 10000,
  };

  /**
   * Load background image with enhanced error handling and retry logic
   */
  async loadBackgroundImage(path: string, options?: Partial<RetryOptions>): Promise<AssetLoadResult> {
    console.log('[AVG Assets] Loading background:', path);

    // Check cache first
    if (this.imageCache.has(path)) {
      const cachedAsset = this.imageCache.get(path)!;
      // Update access time for LRU cache
      this.cacheAccessTimes.set(path, performance.now());
      return {
        success: true,
        asset: cachedAsset,
        retryCount: 0,
      };
    }

    // Check if already loading
    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!;
    }

    // Start loading with retry logic
    const loadPromise = this.loadAssetWithRetry(path, 'background', options);
    this.loadingPromises.set(path, loadPromise);

    try {
      const result = await loadPromise;
      
      if (result.success && result.asset) {
        this.imageCache.set(path, result.asset);
        this.failedAssets.delete(path);
        this.retryAttempts.delete(path);
      } else {
        this.failedAssets.add(path);
      }
      
      return result;
    } finally {
      this.loadingPromises.delete(path);
    }
  }

  /**
   * Load character image with enhanced error handling and retry logic
   */
  async loadCharacterImage(path: string, options?: Partial<RetryOptions>): Promise<AssetLoadResult> {
    console.log('[AVG Assets] Loading character:', path);

    // Check cache first
    if (this.imageCache.has(path)) {
      const cachedAsset = this.imageCache.get(path)!;
      // Update access time for LRU cache
      this.cacheAccessTimes.set(path, performance.now());
      return {
        success: true,
        asset: cachedAsset,
        retryCount: 0,
      };
    }

    // Check if already loading
    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!;
    }

    // Start loading with retry logic
    const loadPromise = this.loadAssetWithRetry(path, 'character', options);
    this.loadingPromises.set(path, loadPromise);

    try {
      const result = await loadPromise;
      
      if (result.success && result.asset) {
        this.imageCache.set(path, result.asset);
        this.failedAssets.delete(path);
        this.retryAttempts.delete(path);
      } else {
        this.failedAssets.add(path);
      }
      
      return result;
    } finally {
      this.loadingPromises.delete(path);
    }
  }

  /**
   * Load asset with retry logic and comprehensive error handling
   */
  private async loadAssetWithRetry(
    path: string, 
    type: 'background' | 'character', 
    options?: Partial<RetryOptions>
  ): Promise<AssetLoadResult> {
    const retryOptions = { ...this.defaultRetryOptions, ...options };
    const currentRetries = this.retryAttempts.get(path) || 0;
    
    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        // Check network status for remote resources
        if (path.startsWith('http')) {
          const isConnected = await this.checkNetworkStatus();
          if (!isConnected) {
            throw this.createAssetError('network', 'No network connection available', path, true);
          }
        }

        const asset = await this.loadImageWithTimeout(path, type, retryOptions.timeoutMs);
        
        // Success - reset retry count and update cache
        this.retryAttempts.delete(path);
        this.cacheAccessTimes.set(path, performance.now());
        
        // Trigger cleanup if cache is getting full
        if (this.imageCache.size > this.maxCacheSize) {
          this.cleanupImageCache();
        }
        
        return {
          success: true,
          asset,
          retryCount: attempt,
        };

      } catch (error) {
        const assetError = this.parseError(error, path);
        
        console.warn(`[AVG Assets] Attempt ${attempt + 1}/${retryOptions.maxRetries + 1} failed for ${type}: ${path}`, assetError);
        
        // If this is the last attempt or error is not retryable, return failure
        if (attempt >= retryOptions.maxRetries || !assetError.canRetry) {
          this.retryAttempts.set(path, currentRetries + attempt + 1);
          
          // Return placeholder as fallback
          const placeholderAsset = type === 'background' 
            ? this.getPlaceholderBackground() 
            : this.getPlaceholderCharacter();
          
          return {
            success: false,
            asset: placeholderAsset,
            error: assetError,
            retryCount: attempt + 1,
          };
        }

        // Wait before retry with exponential backoff
        const delay = retryOptions.retryDelay * Math.pow(retryOptions.backoffMultiplier, attempt);
        await this.sleep(delay);
      }
    }

    // This should never be reached, but just in case
    const fallbackError = this.createAssetError('unknown', 'Maximum retries exceeded', path, true);
    const placeholderAsset = type === 'background' 
      ? this.getPlaceholderBackground() 
      : this.getPlaceholderCharacter();
    
    return {
      success: false,
      asset: placeholderAsset,
      error: fallbackError,
      retryCount: retryOptions.maxRetries + 1,
    };
  }

  /**
   * Load image with timeout
   */
  private async loadImageWithTimeout(path: string, type: 'background' | 'character', timeoutMs: number): Promise<AssetInfo> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(this.createAssetError('timeout', `Image load timeout after ${timeoutMs}ms`, path, true));
      }, timeoutMs);

      try {
        let asset: AssetInfo;

        // Try to load from different sources
        if (path.startsWith('assets/')) {
          asset = await this.loadFromAssets(path, type);
        } else if (path.startsWith('file://') || path.startsWith('/')) {
          asset = await this.loadFromFileSystem(path, type);
        } else if (path.startsWith('http://') || path.startsWith('https://')) {
          asset = await this.loadFromUrl(path, type);
        } else {
          // Default to assets path
          asset = await this.loadFromAssets(`assets/avg/${path}`, type);
        }

        clearTimeout(timeout);
        resolve(asset);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Parse error and create AssetError object
   */
  private parseError(error: any, path: string): AssetError {
    if (error instanceof AssetError) {
      return error;
    }

    const message = error?.message || 'Unknown error';
    
    // Determine error type based on error message or properties
    if (message.includes('Network') || message.includes('fetch')) {
      return this.createAssetError('network', message, path, true);
    }
    
    if (message.includes('not found') || message.includes('404')) {
      return this.createAssetError('file_not_found', message, path, false);
    }
    
    if (message.includes('timeout')) {
      return this.createAssetError('timeout', message, path, true);
    }
    
    if (message.includes('format') || message.includes('invalid')) {
      return this.createAssetError('invalid_format', message, path, false);
    }
    
    return this.createAssetError('unknown', message, path, true);
  }

  /**
   * Create standardized AssetError
   */
  private createAssetError(type: AssetError['type'], message: string, path: string, canRetry: boolean): AssetError {
    return {
      type,
      message,
      originalPath: path,
      canRetry,
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Load image from app assets
   */
  private async loadFromAssets(path: string, type: 'background' | 'character'): Promise<AssetInfo> {
    try {
      // Remove 'assets/' prefix for Asset.fromModule
      const modulePath = path.replace(/^assets\//, '');

      // For now, we'll use a direct URI approach since we don't have actual asset files
      // In a real implementation, you would use Asset.fromModule() with require()
      const uri = path;

      // Validate that the asset exists (in a real app, this would check the bundle)
      // For now, we'll simulate this check
      if (!this.isValidAssetPath(path)) {
        throw this.createAssetError('file_not_found', `Asset not found: ${path}`, path, false);
      }

      return {
        uri,
        type,
        width: type === 'background' ? 1920 : 512,
        height: type === 'background' ? 1080 : 1024,
        isPlaceholder: false,
      };
    } catch (error) {
      if (error instanceof AssetError) {
        throw error;
      }
      throw this.createAssetError('unknown', `Failed to load asset: ${path}`, path, false);
    }
  }

  /**
   * Validate asset path (simplified for demo)
   */
  private isValidAssetPath(path: string): boolean {
    // In a real implementation, this would check if the asset exists in the bundle
    // For now, we'll accept common image extensions
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    return validExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }

  /**
   * Load image from file system
   */
  private async loadFromFileSystem(path: string, type: 'background' | 'character'): Promise<AssetInfo> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(path);

      if (!fileInfo.exists) {
        throw this.createAssetError('file_not_found', `File does not exist: ${path}`, path, false);
      }

      // Check if it's a valid image file
      if (!this.isValidImageFile(path)) {
        throw this.createAssetError('invalid_format', `Invalid image format: ${path}`, path, false);
      }

      return {
        uri: path,
        type,
        width: type === 'background' ? 1920 : 512,
        height: type === 'background' ? 1080 : 1024,
        isPlaceholder: false,
      };
    } catch (error) {
      if (error instanceof AssetError) {
        throw error;
      }
      throw this.createAssetError('unknown', `Failed to load file: ${path}`, path, true);
    }
  }

  /**
   * Validate image file extension
   */
  private isValidImageFile(path: string): boolean {
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];
    return validExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }

  /**
   * Load image from URL with network validation
   */
  private async loadFromUrl(path: string, type: 'background' | 'character'): Promise<AssetInfo> {
    try {
      // Validate URL format
      const url = new URL(path);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw this.createAssetError('invalid_format', `Invalid URL protocol: ${url.protocol}`, path, false);
      }

      // Check if it's likely an image URL
      if (!this.isValidImageUrl(path)) {
        console.warn(`[AVG Assets] URL may not be an image: ${path}`);
      }

      // For URL loading, we'll let the Canvas handle the actual loading
      // but we can do a basic connectivity check
      const isConnected = await this.checkNetworkStatus();
      if (!isConnected) {
        throw this.createAssetError('network', 'No network connection available', path, true);
      }

      return {
        uri: path,
        type,
        width: type === 'background' ? 1920 : 512,
        height: type === 'background' ? 1080 : 1024,
        isPlaceholder: false,
      };
    } catch (error) {
      if (error instanceof AssetError) {
        throw error;
      }
      throw this.createAssetError('network', `Failed to load URL: ${path}`, path, true);
    }
  }

  /**
   * Check if URL looks like an image
   */
  private isValidImageUrl(url: string): boolean {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];
    const lowerUrl = url.toLowerCase();
    
    // Check file extension
    if (imageExtensions.some(ext => lowerUrl.includes(ext))) {
      return true;
    }
    
    // Check for common image hosting patterns
    const imageHosts = ['imgur.com', 'i.imgur.com', 'cdn.', 'images.', 'img.'];
    return imageHosts.some(host => lowerUrl.includes(host));
  }

  /**
   * Preload multiple assets with detailed results
   */
  async preloadAssets(paths: string[], options?: Partial<RetryOptions>): Promise<AssetLoadResult[]> {
    console.log('[AVG Assets] Preloading assets:', paths);

    const loadPromises = paths.map(async (path): Promise<AssetLoadResult> => {
      try {
        // Determine type based on path
        const isBackground = path.includes('background') || path.includes('scene');
        if (isBackground) {
          return await this.loadBackgroundImage(path, options);
        } else {
          return await this.loadCharacterImage(path, options);
        }
      } catch (error) {
        console.warn(`[AVG Assets] Failed to preload: ${path}`, error);
        const assetError = this.parseError(error, path);
        const placeholderAsset = path.includes('background') || path.includes('scene')
          ? this.getPlaceholderBackground()
          : this.getPlaceholderCharacter();
        
        return {
          success: false,
          asset: placeholderAsset,
          error: assetError,
          retryCount: 0,
        };
      }
    });

    const results = await Promise.allSettled(loadPromises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const path = paths[index];
        const assetError = this.parseError(result.reason, path);
        const placeholderAsset = path.includes('background') || path.includes('scene')
          ? this.getPlaceholderBackground()
          : this.getPlaceholderCharacter();
        
        return {
          success: false,
          asset: placeholderAsset,
          error: assetError,
          retryCount: 0,
        };
      }
    });
  }

  /**
   * Get placeholder background image
   */
  getPlaceholderBackground(): AssetInfo {
    // Use Buffer for base64 encoding in React Native
    const svgContent = `
        <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#98FB98;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#bg)"/>
          <circle cx="200" cy="200" r="50" fill="rgba(255,255,255,0.3)"/>
          <circle cx="1720" cy="300" r="80" fill="rgba(255,255,255,0.2)"/>
          <circle cx="960" cy="800" r="60" fill="rgba(255,255,255,0.25)"/>
          <circle cx="400" cy="900" r="40" fill="rgba(255,255,255,0.3)"/>
          <circle cx="1500" cy="700" r="70" fill="rgba(255,255,255,0.2)"/>
          <text x="960" y="540" text-anchor="middle" font-family="Arial" font-size="48" fill="rgba(255,255,255,0.8)">默认背景</text>
          <text x="960" y="600" text-anchor="middle" font-family="Arial" font-size="24" fill="rgba(255,255,255,0.6)">资源加载失败</text>
        </svg>
      `;
    
    return {
      uri: 'data:image/svg+xml;base64,' + Buffer.from(svgContent).toString('base64'),
      width: 1920,
      height: 1080,
      type: 'background',
      isPlaceholder: true,
    };
  }

  /**
   * Get placeholder character image
   */
  getPlaceholderCharacter(): AssetInfo {
    const svgContent = `
        <svg width="512" height="1024" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="transparent"/>
          <g fill="rgba(100,100,100,0.8)">
            <!-- Head -->
            <circle cx="256" cy="200" r="80"/>
            <!-- Body -->
            <rect x="206" y="280" width="100" height="240" rx="20"/>
            <!-- Arms -->
            <rect x="156" y="300" width="50" height="160" rx="25"/>
            <rect x="306" y="300" width="50" height="160" rx="25"/>
            <!-- Legs -->
            <rect x="216" y="520" width="40" height="200" rx="20"/>
            <rect x="256" y="520" width="40" height="200" rx="20"/>
          </g>
          <text x="256" y="800" text-anchor="middle" font-family="Arial" font-size="32" fill="rgba(100,100,100,0.8)">默认角色</text>
          <text x="256" y="840" text-anchor="middle" font-family="Arial" font-size="20" fill="rgba(100,100,100,0.6)">资源加载失败</text>
        </svg>
      `;
    
    return {
      uri: 'data:image/svg+xml;base64,' + Buffer.from(svgContent).toString('base64'),
      width: 512,
      height: 1024,
      type: 'character',
      isPlaceholder: true,
    };
  }

  /**
   * Retry loading a failed asset
   */
  async retryFailedAsset(path: string, type: 'background' | 'character'): Promise<AssetLoadResult> {
    console.log(`[AVG Assets] Retrying failed asset: ${path}`);
    
    // Remove from failed assets set to allow retry
    this.failedAssets.delete(path);
    
    // Clear from cache to force reload
    this.imageCache.delete(path);
    
    // Reset retry count for this asset
    this.retryAttempts.delete(path);
    
    // Attempt to load again
    if (type === 'background') {
      return await this.loadBackgroundImage(path);
    } else {
      return await this.loadCharacterImage(path);
    }
  }

  /**
   * Check network connectivity status
   */
  async checkNetworkStatus(): Promise<boolean> {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected === true;
    } catch (error) {
      console.warn('[AVG Assets] Failed to check network status:', error);
      // Assume connected if we can't check
      return true;
    }
  }

  /**
   * Get list of failed asset paths
   */
  getFailedAssets(): string[] {
    return Array.from(this.failedAssets);
  }

  /**
   * Load any asset with automatic type detection (legacy method for compatibility)
   */
  async loadAsset(path: string): Promise<{ success: boolean; asset?: AssetInfo; error?: string }> {
    try {
      console.log('[AVG Assets] Loading asset:', path);

      // Determine asset type based on path
      const isCharacter = path.includes('character') || path.includes('sprite');
      const assetType: 'background' | 'character' = isCharacter ? 'character' : 'background';

      // Load using new method
      const result = assetType === 'background' 
        ? await this.loadBackgroundImage(path)
        : await this.loadCharacterImage(path);

      return {
        success: result.success,
        asset: result.asset,
        error: result.error?.message,
      };
    } catch (error) {
      console.error('[AVG Assets] Failed to load asset:', path, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown asset loading error',
      };
    }
  }

  /**
   * Clear the asset cache
   */
  clearCache(): void {
    console.log('[AVG Assets] Clearing cache');
    this.imageCache.clear();
    this.loadingPromises.clear();
    this.failedAssets.clear();
    this.retryAttempts.clear();
    this.cacheAccessTimes.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cached: this.imageCache.size,
      loading: this.loadingPromises.size,
      failed: this.failedAssets.size,
      totalRetryAttempts: Array.from(this.retryAttempts.values()).reduce((sum, count) => sum + count, 0),
    };
  }

  /**
   * Get detailed asset status
   */
  getAssetStatus(path: string) {
    return {
      isCached: this.imageCache.has(path),
      isLoading: this.loadingPromises.has(path),
      hasFailed: this.failedAssets.has(path),
      retryCount: this.retryAttempts.get(path) || 0,
    };
  }

  /**
   * Clean up image cache using LRU eviction
   */
  private cleanupImageCache() {
    if (this.imageCache.size <= this.maxCacheSize) return;
    
    // LRU cache eviction: Sort by access time and remove oldest entries
    const entries = Array.from(this.cacheAccessTimes.entries())
      .sort((a, b) => a[1] - b[1]);
    
    const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
    
    toRemove.forEach(([key]) => {
      this.imageCache.delete(key);
      this.cacheAccessTimes.delete(key);
    });
    
    console.log(`[AVG Assets] LRU cache cleanup: removed ${toRemove.length} cached images`);
  }
}

export const avgAssetService = new AVGAssetService();

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

export interface AssetInfo {
  uri: string;
  width?: number;
  height?: number;
  type: 'background' | 'character';
}

export interface AssetLoader {
  loadBackgroundImage(path: string): Promise<AssetInfo>;
  loadCharacterImage(path: string): Promise<AssetInfo>;
  preloadAssets(paths: string[]): Promise<void>;
  getPlaceholderBackground(): AssetInfo;
  getPlaceholderCharacter(): AssetInfo;
  clearCache(): void;
}

export class AVGAssetService implements AssetLoader {
  private imageCache = new Map<string, AssetInfo>();
  private loadingPromises = new Map<string, Promise<AssetInfo>>();

  /**
   * Load background image with caching and error handling
   */
  async loadBackgroundImage(path: string): Promise<AssetInfo> {
    console.log('[AVG Assets] Loading background:', path);

    // Check cache first
    if (this.imageCache.has(path)) {
      return this.imageCache.get(path)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!;
    }

    // Start loading
    const loadPromise = this.loadImageWithFallback(path, 'background');
    this.loadingPromises.set(path, loadPromise);

    try {
      const result = await loadPromise;
      this.imageCache.set(path, result);
      return result;
    } finally {
      this.loadingPromises.delete(path);
    }
  }

  /**
   * Load character image with caching and error handling
   */
  async loadCharacterImage(path: string): Promise<AssetInfo> {
    console.log('[AVG Assets] Loading character:', path);

    // Check cache first
    if (this.imageCache.has(path)) {
      return this.imageCache.get(path)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!;
    }

    // Start loading
    const loadPromise = this.loadImageWithFallback(path, 'character');
    this.loadingPromises.set(path, loadPromise);

    try {
      const result = await loadPromise;
      this.imageCache.set(path, result);
      return result;
    } finally {
      this.loadingPromises.delete(path);
    }
  }

  /**
   * Load image with fallback to placeholder
   */
  private async loadImageWithFallback(path: string, type: 'background' | 'character'): Promise<AssetInfo> {
    try {
      // Try to load from assets first
      if (path.startsWith('assets/')) {
        return await this.loadFromAssets(path, type);
      }

      // Try to load from file system
      if (path.startsWith('file://') || path.startsWith('/')) {
        return await this.loadFromFileSystem(path, type);
      }

      // Try to load from URL
      if (path.startsWith('http://') || path.startsWith('https://')) {
        return await this.loadFromUrl(path, type);
      }

      // Default to assets path
      return await this.loadFromAssets(`assets/avg/${path}`, type);

    } catch (error) {
      console.warn(`[AVG Assets] Failed to load ${type} image: ${path}`, error);
      return type === 'background' ? this.getPlaceholderBackground() : this.getPlaceholderCharacter();
    }
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

      return {
        uri,
        type,
        width: type === 'background' ? 1920 : 512,
        height: type === 'background' ? 1080 : 1024,
      };
    } catch (error) {
      throw new Error(`Failed to load asset: ${path}`);
    }
  }

  /**
   * Load image from file system
   */
  private async loadFromFileSystem(path: string, type: 'background' | 'character'): Promise<AssetInfo> {
    const fileInfo = await FileSystem.getInfoAsync(path);

    if (!fileInfo.exists) {
      throw new Error(`File does not exist: ${path}`);
    }

    return {
      uri: path,
      type,
      width: type === 'background' ? 1920 : 512,
      height: type === 'background' ? 1080 : 1024,
    };
  }

  /**
   * Load image from URL
   */
  private async loadFromUrl(path: string, type: 'background' | 'character'): Promise<AssetInfo> {
    // For URL loading, we'll let the Canvas handle the actual loading
    // and just return the URI
    return {
      uri: path,
      type,
      width: type === 'background' ? 1920 : 512,
      height: type === 'background' ? 1080 : 1024,
    };
  }

  /**
   * Preload multiple assets
   */
  async preloadAssets(paths: string[]): Promise<void> {
    console.log('[AVG Assets] Preloading assets:', paths);

    const loadPromises = paths.map(async (path) => {
      try {
        // Determine type based on path
        const isBackground = path.includes('background') || path.includes('scene');
        if (isBackground) {
          await this.loadBackgroundImage(path);
        } else {
          await this.loadCharacterImage(path);
        }
      } catch (error) {
        console.warn(`[AVG Assets] Failed to preload: ${path}`, error);
      }
    });

    await Promise.allSettled(loadPromises);
  }

  /**
   * Get placeholder background image
   */
  getPlaceholderBackground(): AssetInfo {
    return {
      uri: 'data:image/svg+xml;base64,' + btoa(`
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
        </svg>
      `),
      width: 1920,
      height: 1080,
      type: 'background',
    };
  }

  /**
   * Get placeholder character image
   */
  getPlaceholderCharacter(): AssetInfo {
    return {
      uri: 'data:image/svg+xml;base64,' + btoa(`
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
        </svg>
      `),
      width: 512,
      height: 1024,
      type: 'character',
    };
  }

  /**
   * Clear the asset cache
   */
  clearCache(): void {
    console.log('[AVG Assets] Clearing cache');
    this.imageCache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cached: this.imageCache.size,
      loading: this.loadingPromises.size,
    };
  }
}

export const avgAssetService = new AVGAssetService();

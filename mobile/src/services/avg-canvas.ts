import { CanvasRenderer, Position } from '../types/avg';
import { avgAssetService, AssetLoadResult } from './avg-assets';

/**
 * Canvas Renderer Service for AVG
 * Provides a high-level interface for Canvas operations
 */
export class AVGCanvasService implements CanvasRenderer {
  private canvasRef: React.RefObject<any> | null = null;
  private isReady = false;
  private pendingOperations: Array<() => void> = [];

  constructor() {
    this.canvasRef = null;
  }

  /**
   * Set the canvas component reference
   */
  setCanvasRef(ref: React.RefObject<any>) {
    this.canvasRef = ref;
  }

  /**
   * Mark canvas as ready and execute pending operations
   */
  setReady() {
    this.isReady = true;
    // Execute any pending operations
    this.pendingOperations.forEach(operation => operation());
    this.pendingOperations = [];
  }

  /**
   * Send message to canvas component
   */
  private sendMessage(type: string, data?: any) {
    if (!this.canvasRef?.current) {
      console.warn('Canvas ref not available');
      return;
    }

    const message = JSON.stringify({ type, data });
    this.canvasRef.current.postMessage(message);
  }

  /**
   * Execute operation when canvas is ready, or queue it
   */
  private executeWhenReady(operation: () => void) {
    if (this.isReady) {
      operation();
    } else {
      this.pendingOperations.push(operation);
    }
  }

  /**
   * Load background image with enhanced error handling
   */
  async loadBackground(imagePath: string): Promise<{ success: boolean; isPlaceholder?: boolean; error?: string }> {
    try {
      // Load asset through asset service for caching and error handling
      const result = await avgAssetService.loadBackgroundImage(imagePath);

      return new Promise((resolve) => {
        this.executeWhenReady(() => {
          try {
            this.sendMessage('loadBackground', { 
              imagePath: result.asset!.uri,
              isPlaceholder: result.asset!.isPlaceholder,
              originalPath: imagePath,
            });
            
            resolve({
              success: result.success,
              isPlaceholder: result.asset!.isPlaceholder,
              error: result.error?.message,
            });
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Canvas error',
            });
          }
        });
      });
    } catch (error) {
      console.error('[Canvas Service] Failed to load background:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Load character image at specified position with enhanced error handling
   */
  async loadCharacter(imagePath: string, position: Position): Promise<{ success: boolean; isPlaceholder?: boolean; error?: string }> {
    try {
      // Load asset through asset service for caching and error handling
      const result = await avgAssetService.loadCharacterImage(imagePath);

      return new Promise((resolve) => {
        this.executeWhenReady(() => {
          try {
            this.sendMessage('loadCharacter', { 
              imagePath: result.asset!.uri, 
              position,
              isPlaceholder: result.asset!.isPlaceholder,
              originalPath: imagePath,
            });
            
            resolve({
              success: result.success,
              isPlaceholder: result.asset!.isPlaceholder,
              error: result.error?.message,
            });
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Canvas error',
            });
          }
        });
      });
    } catch (error) {
      console.error('[Canvas Service] Failed to load character:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update character position and expression
   */
  updateCharacter(position: Position, expression?: string): void {
    this.executeWhenReady(() => {
      this.sendMessage('updateCharacter', { position, expression });
    });
  }

  /**
   * Fade character in or out
   */
  fadeCharacter(opacity: number, duration: number = 300): void {
    this.executeWhenReady(() => {
      this.sendMessage('fadeCharacter', { opacity, duration });
    });
  }

  /**
   * Clear the canvas
   */
  clearCanvas(): void {
    this.executeWhenReady(() => {
      this.sendMessage('clearCanvas');
    });
  }

  /**
   * Resize the canvas
   */
  resize(width: number, height: number): void {
    this.executeWhenReady(() => {
      this.sendMessage('resize', { width, height });
    });
  }

  /**
   * Check if canvas is ready
   */
  isCanvasReady(): boolean {
    return this.isReady;
  }

  /**
   * Retry loading a failed background image
   */
  async retryBackground(imagePath: string): Promise<{ success: boolean; isPlaceholder?: boolean; error?: string }> {
    console.log('[Canvas Service] Retrying background:', imagePath);
    const result = await avgAssetService.retryFailedAsset(imagePath, 'background');
    
    return new Promise((resolve) => {
      this.executeWhenReady(() => {
        try {
          this.sendMessage('loadBackground', { 
            imagePath: result.asset!.uri,
            isPlaceholder: result.asset!.isPlaceholder,
            originalPath: imagePath,
          });
          
          resolve({
            success: result.success,
            isPlaceholder: result.asset!.isPlaceholder,
            error: result.error?.message,
          });
        } catch (error) {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Canvas error',
          });
        }
      });
    });
  }

  /**
   * Retry loading a failed character image
   */
  async retryCharacter(imagePath: string, position: Position): Promise<{ success: boolean; isPlaceholder?: boolean; error?: string }> {
    console.log('[Canvas Service] Retrying character:', imagePath);
    const result = await avgAssetService.retryFailedAsset(imagePath, 'character');
    
    return new Promise((resolve) => {
      this.executeWhenReady(() => {
        try {
          this.sendMessage('loadCharacter', { 
            imagePath: result.asset!.uri, 
            position,
            isPlaceholder: result.asset!.isPlaceholder,
            originalPath: imagePath,
          });
          
          resolve({
            success: result.success,
            isPlaceholder: result.asset!.isPlaceholder,
            error: result.error?.message,
          });
        } catch (error) {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Canvas error',
          });
        }
      });
    });
  }

  /**
   * Get failed assets from asset service
   */
  getFailedAssets(): string[] {
    return avgAssetService.getFailedAssets();
  }

  /**
   * Check network status
   */
  async checkNetworkStatus(): Promise<boolean> {
    return avgAssetService.checkNetworkStatus();
  }

  /**
   * Reset the canvas service
   */
  reset(): void {
    this.isReady = false;
    this.pendingOperations = [];
    this.canvasRef = null;
  }
}

// Export singleton instance
export const avgCanvasService = new AVGCanvasService();

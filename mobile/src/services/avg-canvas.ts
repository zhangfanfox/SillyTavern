import { CanvasRenderer, Position } from '../types/avg';
import { avgAssetService } from './avg-assets';

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
   * Load background image
   */
  async loadBackground(imagePath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Load asset through asset service for caching and error handling
        const assetInfo = await avgAssetService.loadBackgroundImage(imagePath);

        this.executeWhenReady(() => {
          try {
            this.sendMessage('loadBackground', { imagePath: assetInfo.uri });
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        // If asset service fails, try direct loading
        console.warn('[Canvas Service] Asset service failed, trying direct load:', error);
        this.executeWhenReady(() => {
          try {
            this.sendMessage('loadBackground', { imagePath });
            resolve();
          } catch (directError) {
            reject(directError);
          }
        });
      }
    });
  }

  /**
   * Load character image at specified position
   */
  async loadCharacter(imagePath: string, position: Position): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Load asset through asset service for caching and error handling
        const assetInfo = await avgAssetService.loadCharacterImage(imagePath);

        this.executeWhenReady(() => {
          try {
            this.sendMessage('loadCharacter', { imagePath: assetInfo.uri, position });
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        // If asset service fails, try direct loading
        console.warn('[Canvas Service] Asset service failed for character, trying direct load:', error);
        this.executeWhenReady(() => {
          try {
            this.sendMessage('loadCharacter', { imagePath, position });
            resolve();
          } catch (directError) {
            reject(directError);
          }
        });
      }
    });
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

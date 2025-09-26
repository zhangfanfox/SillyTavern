// AVG Canvas Service - Placeholder implementation
// Will be fully implemented in task 2.1

import { CanvasRenderer, Position } from '../types/avg';

export class AVGCanvasService implements CanvasRenderer {
  async loadBackground(imagePath: string): Promise<void> {
    console.log('[AVG Canvas] Load background:', imagePath);
    // TODO: Implement actual canvas background loading
  }

  async loadCharacter(imagePath: string, position: Position): Promise<void> {
    console.log('[AVG Canvas] Load character:', imagePath, position);
    // TODO: Implement actual canvas character loading
  }

  updateCharacter(position: Position, expression?: string): void {
    console.log('[AVG Canvas] Update character:', position, expression);
    // TODO: Implement character position/expression updates
  }

  clearCanvas(): void {
    console.log('[AVG Canvas] Clear canvas');
    // TODO: Implement canvas clearing
  }

  resize(width: number, height: number): void {
    console.log('[AVG Canvas] Resize canvas:', width, height);
    // TODO: Implement canvas resizing
  }
}

export const avgCanvasService = new AVGCanvasService();
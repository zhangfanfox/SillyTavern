import { useRef, useCallback, useEffect } from 'react';
import { avgCanvasService } from '../services/avg-canvas';
import { Position } from '../types/avg';

/**
 * Hook for managing AVG Canvas operations
 */
export function useAVGCanvas() {
  const canvasRef = useRef<any>(null);

  // Set up canvas service when component mounts
  useEffect(() => {
    avgCanvasService.setCanvasRef(canvasRef);

    return () => {
      avgCanvasService.reset();
    };
  }, []);

  // Handle canvas ready callback
  const handleCanvasReady = useCallback(() => {
    avgCanvasService.setReady();
  }, []);

  // Canvas operations
  const loadBackground = useCallback(async (imagePath: string) => {
    return avgCanvasService.loadBackground(imagePath);
  }, []);

  const loadCharacter = useCallback(async (imagePath: string, position: Position) => {
    return avgCanvasService.loadCharacter(imagePath, position);
  }, []);

  const updateCharacter = useCallback((position: Position, expression?: string) => {
    avgCanvasService.updateCharacter(position, expression);
  }, []);

  const clearCanvas = useCallback(() => {
    avgCanvasService.clearCanvas();
  }, []);

  const resize = useCallback((width: number, height: number) => {
    avgCanvasService.resize(width, height);
  }, []);

  const fadeCharacter = useCallback((opacity: number, duration?: number) => {
    avgCanvasService.fadeCharacter(opacity, duration);
  }, []);

  return {
    canvasRef,
    handleCanvasReady,
    loadBackground,
    loadCharacter,
    updateCharacter,
    clearCanvas,
    resize,
    fadeCharacter,
    isReady: avgCanvasService.isCanvasReady(),
  };
}

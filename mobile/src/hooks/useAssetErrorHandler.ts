import { useState, useCallback, useRef } from 'react';
import { AssetError } from '../services/avg-assets';
import { avgCanvasService } from '../services/avg-canvas';

export interface UseAssetErrorHandlerReturn {
  errors: AssetError[];
  addError: (error: AssetError) => void;
  removeError: (path: string) => void;
  clearAllErrors: () => void;
  retryAsset: (path: string, type: 'background' | 'character') => Promise<void>;
  hasErrors: boolean;
  errorCount: number;
}

export const useAssetErrorHandler = (): UseAssetErrorHandlerReturn => {
  const [errors, setErrors] = useState<AssetError[]>([]);
  const errorTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addError = useCallback((error: AssetError) => {
    setErrors(prev => {
      // Remove existing error for the same path
      const filtered = prev.filter(e => e.originalPath !== error.originalPath);
      return [...filtered, error];
    });

    // Auto-dismiss non-retryable errors after 5 seconds
    if (!error.canRetry) {
      const existingTimeout = errorTimeouts.current.get(error.originalPath);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        removeError(error.originalPath);
      }, 5000);

      errorTimeouts.current.set(error.originalPath, timeout);
    }
  }, []);

  const removeError = useCallback((path: string) => {
    setErrors(prev => prev.filter(e => e.originalPath !== path));
    
    // Clear timeout if exists
    const timeout = errorTimeouts.current.get(path);
    if (timeout) {
      clearTimeout(timeout);
      errorTimeouts.current.delete(path);
    }
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors([]);
    
    // Clear all timeouts
    errorTimeouts.current.forEach(timeout => clearTimeout(timeout));
    errorTimeouts.current.clear();
  }, []);

  const retryAsset = useCallback(async (path: string, type: 'background' | 'character') => {
    try {
      let result;
      
      if (type === 'background') {
        result = await avgCanvasService.retryBackground(path);
      } else {
        // For character, we need position - use default center position
        const defaultPosition = { x: 0.5, y: 0.8, scale: 1.0 };
        result = await avgCanvasService.retryCharacter(path, defaultPosition);
      }

      if (result.success) {
        // Remove error on successful retry
        removeError(path);
      } else if (result.error) {
        // Update error with new information
        const updatedError: AssetError = {
          type: 'unknown',
          message: result.error,
          originalPath: path,
          canRetry: true,
        };
        addError(updatedError);
      }
    } catch (error) {
      console.error('Asset retry failed:', error);
      
      // Add retry failure error
      const retryError: AssetError = {
        type: 'unknown',
        message: error instanceof Error ? error.message : 'Retry failed',
        originalPath: path,
        canRetry: true,
      };
      addError(retryError);
    }
  }, [addError, removeError]);

  return {
    errors,
    addError,
    removeError,
    clearAllErrors,
    retryAsset,
    hasErrors: errors.length > 0,
    errorCount: errors.length,
  };
};
// AVG Streaming Text Service - Manages streaming dialogue display

import { StreamCallbacks } from '../types/avg';

export interface StreamingState {
  isStreaming: boolean;
  currentText: string;
  fullText: string;
  canInterrupt: boolean;
}

export class AVGStreamingService {
  private currentStream?: {
    callbacks: StreamCallbacks;
    state: StreamingState;
    onStateChange: (state: StreamingState) => void;
  };

  /**
   * Start a new streaming session
   */
  startStreaming(
    callbacks: StreamCallbacks,
    onStateChange: (state: StreamingState) => void
  ): void {
    // Cancel any existing stream
    this.stopStreaming();

    const state: StreamingState = {
      isStreaming: true,
      currentText: '',
      fullText: '',
      canInterrupt: true,
    };

    this.currentStream = {
      callbacks: {
        onToken: (token: string) => {
          if (this.currentStream) {
            this.currentStream.state.currentText += token;
            this.currentStream.state.fullText += token;
            this.currentStream.onStateChange(this.currentStream.state);
          }
          callbacks.onToken(token);
        },
        onComplete: (fullText: string) => {
          if (this.currentStream) {
            this.currentStream.state.isStreaming = false;
            this.currentStream.state.fullText = fullText;
            this.currentStream.state.currentText = fullText;
            this.currentStream.onStateChange(this.currentStream.state);
          }
          callbacks.onComplete(fullText);
          this.currentStream = undefined;
        },
        onError: (error: Error) => {
          if (this.currentStream) {
            this.currentStream.state.isStreaming = false;
            this.currentStream.onStateChange(this.currentStream.state);
          }
          callbacks.onError(error);
          this.currentStream = undefined;
        },
      },
      state,
      onStateChange,
    };

    onStateChange(state);
  }

  /**
   * Stop current streaming session
   */
  stopStreaming(): void {
    if (this.currentStream) {
      this.currentStream.state.isStreaming = false;
      this.currentStream.state.canInterrupt = false;
      this.currentStream.onStateChange(this.currentStream.state);
      this.currentStream = undefined;
    }
  }

  /**
   * Interrupt streaming and show full text immediately
   */
  interruptStreaming(): boolean {
    if (this.currentStream && this.currentStream.state.canInterrupt) {
      const fullText = this.currentStream.state.fullText;
      this.currentStream.state.isStreaming = false;
      this.currentStream.state.currentText = fullText;
      this.currentStream.state.canInterrupt = false;
      this.currentStream.onStateChange(this.currentStream.state);
      
      // Call completion callback
      this.currentStream.callbacks.onComplete(fullText);
      this.currentStream = undefined;
      return true;
    }
    return false;
  }

  /**
   * Get current streaming state
   */
  getCurrentState(): StreamingState | null {
    return this.currentStream?.state || null;
  }

  /**
   * Check if currently streaming
   */
  isStreaming(): boolean {
    return this.currentStream?.state.isStreaming || false;
  }
}

export const avgStreamingService = new AVGStreamingService();
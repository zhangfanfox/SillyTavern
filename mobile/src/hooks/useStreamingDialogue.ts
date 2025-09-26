// Custom hook for managing streaming dialogue display

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAVGStore } from '../stores/avg';

export interface StreamingDialogueState {
  displayText: string;
  isStreaming: boolean;
  isAnimating: boolean;
  canSkip: boolean;
  speaker: string;
}

export function useStreamingDialogue() {
  const {
    streamingText,
    isStreaming,
    dialogueHistory,
    gameConfig,
    interruptStreaming,
  } = useAVGStore();

  const [displayText, setDisplayText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const textIndexRef = useRef(0);

  // Get the latest dialogue entry
  const latestDialogue = dialogueHistory[dialogueHistory.length - 1];
  const speaker = latestDialogue?.speaker || gameConfig?.characterName || 'Character';

  // Handle streaming text updates
  useEffect(() => {
    if (isStreaming) {
      // During streaming, show text as it comes in
      setDisplayText(streamingText);
      setCanSkip(false);
      setIsAnimating(false);
    } else if (latestDialogue && latestDialogue.type === 'character') {
      // When streaming stops, check if we need to animate the complete text
      const fullText = latestDialogue.text;
      if (fullText !== displayText && fullText.length > 0) {
        startTextAnimation(fullText);
      }
    }
  }, [streamingText, isStreaming, latestDialogue]);

  // Start typewriter animation for complete text
  const startTextAnimation = useCallback((fullText: string) => {
    if (fullText === displayText) {
      return;
    }

    setIsAnimating(true);
    setCanSkip(true);
    textIndexRef.current = displayText.length;

    const animateText = () => {
      if (textIndexRef.current < fullText.length) {
        setDisplayText(fullText.substring(0, textIndexRef.current + 1));
        textIndexRef.current++;
        
        // Variable speed based on character type
        const char = fullText[textIndexRef.current - 1];
        let delay = 30; // Default delay
        
        if (char === '.' || char === '!' || char === '?') {
          delay = 200; // Longer pause for sentence endings
        } else if (char === ',' || char === ';') {
          delay = 100; // Medium pause for commas
        } else if (char === ' ') {
          delay = 20; // Shorter delay for spaces
        }

        animationRef.current = setTimeout(animateText, delay);
      } else {
        setIsAnimating(false);
        setCanSkip(false);
        if (animationRef.current) {
          clearTimeout(animationRef.current);
          animationRef.current = null;
        }
      }
    };

    animateText();
  }, [displayText]);

  // Skip animation and show full text immediately
  const skipAnimation = useCallback(() => {
    if (isStreaming) {
      // Interrupt streaming
      interruptStreaming();
    } else if (canSkip && isAnimating && latestDialogue) {
      // Skip text animation
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      setDisplayText(latestDialogue.text);
      setIsAnimating(false);
      setCanSkip(false);
    }
  }, [isStreaming, canSkip, isAnimating, latestDialogue, interruptStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  const state: StreamingDialogueState = {
    displayText,
    isStreaming,
    isAnimating,
    canSkip: canSkip || isStreaming,
    speaker,
  };

  return {
    state,
    skipAnimation,
  };
}
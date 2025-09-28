import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ViewStyle } from 'react-native';
import { Card } from 'react-native-paper';
import { useStreamingDialogue } from '../../src/hooks/useStreamingDialogue';

interface AVGDialogueBoxProps {
  speaker?: string;
  text?: string;
  isStreaming?: boolean;
  visible?: boolean;
  onComplete?: () => void;
  style?: ViewStyle;
}

export default function AVGDialogueBox({
  speaker,
  text,
  isStreaming = false,
  visible = true,
  onComplete,
  style,
}: AVGDialogueBoxProps) {
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  // Use props if provided, otherwise fall back to streaming dialogue hook
  const { state, skipAnimation } = useStreamingDialogue();
  
  // Determine actual values to use
  const actualSpeaker = speaker || state.speaker || 'Assistant';
  const actualText = text || state.displayText || '';
  const actualIsStreaming = isStreaming || state.isStreaming;
  const canSkip = state.canSkip && actualIsStreaming;

  // Cursor blinking animation
  useEffect(() => {
    if (actualIsStreaming) {
      const blinkAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cursorOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      blinkAnimation.start();
      return () => blinkAnimation.stop();
    } else {
      cursorOpacity.setValue(0);
    }
  }, [actualIsStreaming, cursorOpacity]);

  // Call onComplete when streaming finishes
  useEffect(() => {
    if (!actualIsStreaming && onComplete && actualText) {
      const timer = setTimeout(onComplete, 500); // Small delay for better UX
      return () => clearTimeout(timer);
    }
  }, [actualIsStreaming, onComplete, actualText]);

  if (!visible || (!actualText && !actualIsStreaming)) {
    return null;
  }

  const showCursor = actualIsStreaming;

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={canSkip ? skipAnimation : undefined}
      activeOpacity={canSkip ? 0.7 : 1}
      disabled={!canSkip}
    >
      <Card style={styles.card}>
        <Card.Content style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.speaker}>{actualSpeaker}</Text>
            {canSkip && (
              <View style={styles.skipHint}>
                <Text style={styles.skipText}>轻触跳过</Text>
              </View>
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.text}>
              {actualText}
              {showCursor && (
                <Animated.Text 
                  style={[styles.cursor, { opacity: cursorOpacity }]}
                >
                  |
                </Animated.Text>
              )}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  card: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  content: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  speaker: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  skipHint: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  skipText: {
    fontSize: 12,
    color: '#ffffff',
    opacity: 0.8,
  },
  textContainer: {
    minHeight: 60,
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#ffffff',
  },
  cursor: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

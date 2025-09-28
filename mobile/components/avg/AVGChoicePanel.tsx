import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity, Text } from 'react-native';
import { Card } from 'react-native-paper';
import { AVGChoicePanelProps, Choice } from '../../src/types/avg';
import { useAVGStore } from '../../src/stores/avg';

export default function AVGChoicePanel({
  choices,
  onChoiceSelect,
  visible,
  style,
}: AVGChoicePanelProps) {
  const { startStreamingResponse, setChoicePanelVisible } = useAVGStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Animation for showing/hiding the panel
  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  // Handle choice selection
  const handleChoiceSelect = async (choice: Choice) => {
    console.log('[AVGChoicePanel] Choice selected:', choice);
    
    // Hide the choice panel immediately
    setChoicePanelVisible(false);
    
    // Call the onChoiceSelect callback if provided
    if (onChoiceSelect) {
      onChoiceSelect(choice);
    }
    
    // Start streaming response with the selected choice text
    try {
      await startStreamingResponse(choice.text);
    } catch (error) {
      console.error('[AVGChoicePanel] Failed to process choice:', error);
    }
  };

  if (!visible || choices.length === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        style,
      ]}
    >
      <Card style={styles.card}>
        <Card.Content style={styles.content}>
          <Text style={styles.title}>选择你的回应</Text>
          <View style={styles.choicesContainer}>
            {choices.map((choice, index) => (
              <TouchableOpacity
                key={choice.id}
                style={[
                  styles.choiceButton,
                  index === choices.length - 1 && styles.lastChoice,
                ]}
                onPress={() => handleChoiceSelect(choice)}
                activeOpacity={0.7}
              >
                <View style={styles.choiceContent}>
                  <Text style={styles.choiceText}>{choice.text}</Text>
                  {choice.metadata?.hint && (
                    <Text style={styles.choiceHint}>{choice.metadata.hint}</Text>
                  )}
                </View>
                <View style={styles.choiceArrow}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Card.Content>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  card: {
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    borderRadius: 16,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.9,
  },
  choicesContainer: {
    gap: 12,
  },
  choiceButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
  },
  lastChoice: {
    marginBottom: 0,
  },
  choiceContent: {
    flex: 1,
    paddingRight: 12,
  },
  choiceText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#ffffff',
    fontWeight: '500',
  },
  choiceHint: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
    fontStyle: 'italic',
  },
  choiceArrow: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  arrowText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

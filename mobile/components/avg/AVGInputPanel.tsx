import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Animated, 
  TouchableOpacity, 
  Text, 
  TextInput as RNTextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Card, IconButton } from 'react-native-paper';
import { AVGInputPanelProps } from '../../src/types/avg';
import { useAVGStore } from '../../src/stores/avg';

export default function AVGInputPanel({
  visible,
  onSubmit,
  onCancel,
}: AVGInputPanelProps) {
  const { startStreamingResponse, setInputPanelVisible } = useAVGStore();
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const inputRef = useRef<RNTextInput>(null);

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
      ]).start(() => {
        // Focus input after animation completes
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      });
    } else {
      // Hide animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  // Clear error when text changes
  useEffect(() => {
    if (error && text.trim()) {
      setError(null);
    }
  }, [text, error]);

  // Validate input
  const validateInput = (input: string): string | null => {
    const trimmed = input.trim();
    
    if (!trimmed) {
      return '请输入有效内容';
    }
    
    if (trimmed.length < 1) {
      return '输入内容太短';
    }
    
    if (trimmed.length > 500) {
      return '输入内容太长（最多500字符）';
    }
    
    return null;
  };

  // Handle submit
  const handleSubmit = async () => {
    const validationError = validateInput(text);
    
    if (validationError) {
      setError(validationError);
      Alert.alert('输入错误', validationError);
      return;
    }

    const trimmedText = text.trim();
    console.log('[AVGInputPanel] Submitting input:', trimmedText);
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Hide the input panel immediately
      setInputPanelVisible(false);
      
      // Call the onSubmit callback if provided
      if (onSubmit) {
        onSubmit(trimmedText);
      }
      
      // Start streaming response with the user input
      await startStreamingResponse(trimmedText);
      
      // Clear the input after successful submission
      setText('');
      
    } catch (error) {
      console.error('[AVGInputPanel] Failed to submit input:', error);
      setError('发送失败，请重试');
      Alert.alert('发送失败', '请检查网络连接后重试');
      
      // Show the panel again on error
      setInputPanelVisible(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    console.log('[AVGInputPanel] Input cancelled');
    
    // Clear input and error
    setText('');
    setError(null);
    
    // Hide the input panel
    setInputPanelVisible(false);
    
    // Call the onCancel callback if provided
    if (onCancel) {
      onCancel();
    }
  };

  // Handle key press (Enter to submit on some platforms)
  const handleKeyPress = (event: any) => {
    if (event.nativeEvent.key === 'Enter' && !event.nativeEvent.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  if (!visible) {
    return null;
  }

  const isInputValid = text.trim().length > 0;
  const characterCount = text.length;
  const maxCharacters = 500;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoid}
    >
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Card style={styles.card}>
          <Card.Content style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>输入你的回应</Text>
              <IconButton
                icon="close"
                size={20}
                iconColor="#ffffff"
                onPress={handleCancel}
                style={styles.closeButton}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <RNTextInput
                ref={inputRef}
                style={[
                  styles.textInput,
                  error && styles.textInputError,
                ]}
                value={text}
                onChangeText={setText}
                onKeyPress={handleKeyPress}
                placeholder="在这里输入你想说的话..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                multiline
                numberOfLines={4}
                maxLength={maxCharacters}
                editable={!isSubmitting}
                textAlignVertical="top"
              />
              
              <View style={styles.inputFooter}>
                <View style={styles.characterCount}>
                  <Text style={[
                    styles.characterCountText,
                    characterCount > maxCharacters * 0.9 && styles.characterCountWarning,
                  ]}>
                    {characterCount}/{maxCharacters}
                  </Text>
                </View>
                
                {error && (
                  <Text style={styles.errorText}>{error}</Text>
                )}
              </View>
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.submitButton,
                  (!isInputValid || isSubmitting) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!isInputValid || isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.submitButtonText,
                  (!isInputValid || isSubmitting) && styles.submitButtonTextDisabled,
                ]}>
                  {isSubmitting ? '发送中...' : '发送'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: 'rgba(20, 20, 30, 0.98)',
    borderRadius: 16,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButton: {
    margin: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputContainer: {
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 22,
    color: '#ffffff',
    minHeight: 100,
    maxHeight: 150,
  },
  textInputError: {
    borderColor: '#ff6b6b',
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  characterCount: {
    flex: 1,
  },
  characterCountText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  characterCountWarning: {
    color: '#ffa726',
  },
  errorText: {
    fontSize: 12,
    color: '#ff6b6b',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  submitButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
});

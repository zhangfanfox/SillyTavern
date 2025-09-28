import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Snackbar, Button, Text, Card, IconButton } from 'react-native-paper';
import { AssetError } from '../../src/services/avg-assets';

export interface AVGErrorHandlerProps {
  errors: AssetError[];
  onRetry: (path: string, type: 'background' | 'character') => Promise<void>;
  onDismiss: (path: string) => void;
  onDismissAll: () => void;
}

interface ErrorState {
  visible: boolean;
  currentError: AssetError | null;
  isRetrying: boolean;
}

const AVGErrorHandler: React.FC<AVGErrorHandlerProps> = ({
  errors,
  onRetry,
  onDismiss,
  onDismissAll,
}) => {
  const [errorState, setErrorState] = useState<ErrorState>({
    visible: false,
    currentError: null,
    isRetrying: false,
  });

  // Show error when new errors arrive
  useEffect(() => {
    if (errors.length > 0 && !errorState.visible) {
      setErrorState({
        visible: true,
        currentError: errors[0],
        isRetrying: false,
      });
    }
  }, [errors, errorState.visible]);

  const handleRetry = async () => {
    if (!errorState.currentError) return;

    setErrorState(prev => ({ ...prev, isRetrying: true }));

    try {
      // Determine asset type from path
      const isBackground = errorState.currentError.originalPath.includes('background') || 
                          errorState.currentError.originalPath.includes('scene');
      const assetType = isBackground ? 'background' : 'character';

      await onRetry(errorState.currentError.originalPath, assetType);
      
      // Dismiss current error after successful retry
      handleDismiss();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setErrorState(prev => ({ ...prev, isRetrying: false }));
    }
  };

  const handleDismiss = () => {
    if (errorState.currentError) {
      onDismiss(errorState.currentError.originalPath);
    }
    
    // Show next error if available
    const remainingErrors = errors.filter(e => e !== errorState.currentError);
    if (remainingErrors.length > 0) {
      setErrorState({
        visible: true,
        currentError: remainingErrors[0],
        isRetrying: false,
      });
    } else {
      setErrorState({
        visible: false,
        currentError: null,
        isRetrying: false,
      });
    }
  };

  const getErrorMessage = (error: AssetError): string => {
    switch (error.type) {
      case 'network':
        return '网络连接失败，请检查网络设置';
      case 'file_not_found':
        return '资源文件未找到';
      case 'invalid_format':
        return '资源格式不支持';
      case 'timeout':
        return '资源加载超时';
      default:
        return '资源加载失败';
    }
  };

  const getErrorIcon = (error: AssetError): string => {
    switch (error.type) {
      case 'network':
        return 'wifi-off';
      case 'file_not_found':
        return 'file-question';
      case 'invalid_format':
        return 'file-alert';
      case 'timeout':
        return 'clock-alert';
      default:
        return 'alert-circle';
    }
  };

  if (!errorState.visible || !errorState.currentError) {
    return null;
  }

  const error = errorState.currentError;
  const errorMessage = getErrorMessage(error);
  const errorIcon = getErrorIcon(error);

  return (
    <View style={styles.container}>
      <Snackbar
        visible={errorState.visible}
        onDismiss={handleDismiss}
        duration={Snackbar.DURATION_INDEFINITE}
        style={styles.snackbar}
        action={{
          label: error.canRetry ? '重试' : '确定',
          onPress: error.canRetry ? handleRetry : handleDismiss,
          loading: errorState.isRetrying,
        }}
      >
        <View style={styles.errorContent}>
          <Text style={styles.errorMessage}>
            {errorMessage}
          </Text>
          <Text style={styles.errorPath} numberOfLines={1}>
            {error.originalPath}
          </Text>
        </View>
      </Snackbar>

      {/* Multiple errors indicator */}
      {errors.length > 1 && (
        <Card style={styles.multiErrorCard}>
          <Card.Content style={styles.multiErrorContent}>
            <View style={styles.multiErrorHeader}>
              <IconButton
                icon={errorIcon}
                size={20}
                iconColor="#ff6b6b"
              />
              <Text style={styles.multiErrorTitle}>
                {errors.length} 个资源加载失败
              </Text>
              <IconButton
                icon="close"
                size={20}
                onPress={onDismissAll}
              />
            </View>
            
            <Text style={styles.multiErrorSubtitle}>
              点击重试所有失败的资源
            </Text>
            
            <View style={styles.multiErrorActions}>
              <Button
                mode="outlined"
                onPress={onDismissAll}
                style={styles.multiErrorButton}
              >
                忽略全部
              </Button>
              <Button
                mode="contained"
                onPress={async () => {
                  setErrorState(prev => ({ ...prev, isRetrying: true }));
                  
                  try {
                    // Retry all failed assets
                    for (const err of errors) {
                      const isBackground = err.originalPath.includes('background') || 
                                          err.originalPath.includes('scene');
                      const assetType = isBackground ? 'background' : 'character';
                      
                      try {
                        await onRetry(err.originalPath, assetType);
                      } catch (retryError) {
                        console.warn('Failed to retry asset:', err.originalPath, retryError);
                      }
                    }
                    
                    onDismissAll();
                  } finally {
                    setErrorState(prev => ({ ...prev, isRetrying: false }));
                  }
                }}
                loading={errorState.isRetrying}
                style={styles.multiErrorButton}
              >
                重试全部
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}
    </View>
  );
};

export default AVGErrorHandler;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  snackbar: {
    marginBottom: 16,
  },
  errorContent: {
    flex: 1,
  },
  errorMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  errorPath: {
    fontSize: 12,
    opacity: 0.8,
    color: '#fff',
    marginTop: 2,
  },
  multiErrorCard: {
    margin: 16,
    backgroundColor: '#fff',
  },
  multiErrorContent: {
    paddingVertical: 12,
  },
  multiErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  multiErrorTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#ff6b6b',
    marginLeft: 8,
  },
  multiErrorSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    marginLeft: 36,
  },
  multiErrorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  multiErrorButton: {
    minWidth: 80,
  },
});
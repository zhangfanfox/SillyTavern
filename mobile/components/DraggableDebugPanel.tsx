import { useMemo } from 'react';
import { Animated, PanResponder, Dimensions, ScrollView, StyleSheet, View, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { IconButton, Text } from 'react-native-paper';

type Props = {
  visible: boolean;
  onClose: () => void;
  content: string;
  title?: string;
};

export default function DraggableDebugPanel({ visible, onClose, content, title = '调试' }: Props) {
  const screen = Dimensions.get('window');
  const pos = useMemo(() => new Animated.ValueXY({ x: 12, y: screen.height * 0.35 }), [screen.height]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Only start pan when gesture begins near the header (y within top 40px of the panel)
        onStartShouldSetPanResponder: (_, gesture) => visible && gesture.y0 - (pos as any).y._value < 40,
        onMoveShouldSetPanResponder: (_, gesture) => visible && gesture.y0 - (pos as any).y._value < 40,
        onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
        onPanResponderGrant: () => {
          pos.setOffset({ x: (pos as any).x._value, y: (pos as any).y._value });
          pos.setValue({ x: 0, y: 0 });
        },
        onPanResponderRelease: () => {
          pos.flattenOffset();
        },
      }),
    [pos, visible],
  );

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { transform: pos.getTranslateTransform() }]} {...panResponder.panHandlers}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
  <View style={styles.headerBtns}>
          <IconButton
            icon="content-copy"
            onPress={async () => { await Clipboard.setStringAsync(content || ''); }}
            accessibilityLabel="复制全部"
            size={18}
          />
          <IconButton icon="close" onPress={onClose} accessibilityLabel="关闭调试面板" size={18} />
        </View>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator>
        <Text selectable style={styles.mono}>{content || '暂无日志'}</Text>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
    width: 320,
    height: 260,
    backgroundColor: 'white',
    borderRadius: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  title: { fontWeight: '600' },
  body: { flex: 1 },
  bodyContent: { padding: 8 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 12 },
  headerBtns: { flexDirection: 'row', alignItems: 'center' },
});

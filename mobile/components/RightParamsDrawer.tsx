import { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { useUIStore, type UIState } from '../src/stores/ui';

const WIDTH = Math.min(380, Math.floor(Dimensions.get('window').width * 0.9));

export default function RightParamsDrawer() {
  const open = useUIStore((s: UIState) => s.rightPanelOpen);
  const setOpen = useUIStore((s: UIState) => s.setRightPanelOpen);

  return (
    <Portal>
      <Modal visible={open} onDismiss={() => setOpen(false)} contentContainerStyle={styles.modal}>
        <View style={styles.header}>
          <Text variant="titleMedium">参数面板</Text>
          <Button compact onPress={() => setOpen(false)}>关闭</Button>
        </View>
        <View style={styles.content}>
          <Text>选择 Provider、模型与温度等（M2 实现动态渲染）。</Text>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    marginLeft: 'auto',
    marginRight: 0,
    width: WIDTH,
    backgroundColor: 'white',
    padding: 16,
    height: '100%'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  content: {
    flex: 1
  }
});

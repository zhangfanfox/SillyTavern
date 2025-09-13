import { View, StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useState } from 'react';
import { useRolesStore } from '../../src/stores/roles';
import { useRouter } from 'expo-router';

export default function RoleCreateScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [system, setSystem] = useState('');
  const create = useRolesStore((s) => s.createRole);
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text variant="titleLarge">新建角色</Text>
      <TextInput label="名称" mode="outlined" value={name} onChangeText={setName} placeholder="如：Seraphina" />
      <TextInput label="简介" mode="outlined" value={description} onChangeText={setDescription} placeholder="一句话描述" />
      <TextInput label="系统提示" mode="outlined" value={system} onChangeText={setSystem} multiline numberOfLines={6} placeholder="系统提示..." />
      <Button
        mode="contained"
        onPress={async () => {
          if (!name.trim()) return;
          await create({ name: name.trim(), description: description.trim(), system_prompt: system } as any);
          router.back();
        }}
      >
        保存
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
});

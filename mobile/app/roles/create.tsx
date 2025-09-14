import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Button, Divider, Switch, Text, TextInput } from 'react-native-paper';
import { useState } from 'react';
import { useRolesStore } from '../../src/stores/roles';
import { useRouter } from 'expo-router';

export default function RoleCreateScreen() {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [description, setDescription] = useState('');
  const [system, setSystem] = useState('');
  const [first, setFirst] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creatorNotes, setCreatorNotes] = useState('');
  const [summary, setSummary] = useState('');
  const [scenario, setScenario] = useState('');
  const [depth, setDepth] = useState('');
  const [speakFrequency, setSpeakFrequency] = useState('');
  const [tags, setTags] = useState('');
  const create = useRolesStore((s) => s.createRole);
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="titleLarge">新建角色</Text>
      <TextInput label="名称" mode="outlined" value={name} onChangeText={setName} placeholder="如：Seraphina" />
      <TextInput label="头像 URL" mode="outlined" value={avatar} onChangeText={setAvatar} placeholder="https://..." />
      {!!avatar && <Image source={{ uri: avatar }} style={styles.avatar} />}
      <TextInput label="简介" mode="outlined" value={description} onChangeText={setDescription} placeholder="一句话描述" />
      <TextInput label="系统提示" mode="outlined" value={system} onChangeText={setSystem} multiline numberOfLines={6} placeholder="系统提示..." />
      <TextInput label="第一条消息（first_message）" mode="outlined" value={first} onChangeText={setFirst} multiline numberOfLines={4} placeholder="可选，开场助理消息" />

      <View style={styles.rowBetween}>
        <Text variant="titleMedium">高级设置</Text>
        <Switch value={showAdvanced} onValueChange={setShowAdvanced} />
      </View>

      {showAdvanced && (
        <View style={styles.advancedBox}>
          <TextInput label="创作者注释 (creator_notes)" mode="outlined" value={creatorNotes} onChangeText={setCreatorNotes} multiline numberOfLines={4} />
          <TextInput label="设定摘要 (summary)" mode="outlined" value={summary} onChangeText={setSummary} multiline numberOfLines={3} />
          <TextInput label="情景 (scenario)" mode="outlined" value={scenario} onChangeText={setScenario} multiline numberOfLines={3} />
          <View style={styles.rowBetween}>
            <TextInput style={styles.flex1} label="深度 (depth)" mode="outlined" value={depth} onChangeText={setDepth} keyboardType="numeric" />
            <View style={styles.spacer} />
            <TextInput style={styles.flex1} label="发言频率 (speak_frequency)" mode="outlined" value={speakFrequency} onChangeText={setSpeakFrequency} keyboardType="numeric" />
          </View>
          <TextInput label="标签 (逗号分隔)" mode="outlined" value={tags} onChangeText={setTags} />
        </View>
      )}

      <Divider />

      <Button
        mode="contained"
        onPress={async () => {
          const nm = name.trim();
          if (!nm) return;
          await create({
            name: nm,
            avatar: avatar.trim() || undefined,
            description: description.trim(),
            system_prompt: system,
            first_message: first,
            creator_notes: creatorNotes,
            summary,
            scenario,
            depth: depth ? Number(depth) : undefined,
            speak_frequency: speakFrequency ? Number(speakFrequency) : undefined,
            tags: tags ? tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
          } as any);
          router.back();
        }}
      >
        保存
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  advancedBox: { gap: 12 },
  flex1: { flex: 1 },
  avatar: { width: 80, height: 80, borderRadius: 8 },
  spacer: { width: 8 },
});

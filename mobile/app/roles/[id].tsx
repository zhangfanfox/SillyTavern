import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Button, Divider, Switch, Text, TextInput } from 'react-native-paper';
import { useRolesStore } from '../../src/stores/roles';

export default function RoleEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { roles, updateRole } = useRolesStore();
  const router = useRouter();
  const normalizedId = useMemo(() => {
    try { return decodeURIComponent(String(id)); } catch { return String(id); }
  }, [id]);
  const role = useMemo(() => roles.find((r) => r.id === normalizedId), [roles, normalizedId]);

  const [name, setName] = useState(role?.name || '');
  const [avatar, setAvatar] = useState(role?.avatar || '');
  const [description, setDescription] = useState(role?.description || '');
  const [system, setSystem] = useState(role?.system_prompt || '');
  const [first, setFirst] = useState(role?.first_message || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [creatorNotes, setCreatorNotes] = useState(role?.creator_notes || '');
  const [summary, setSummary] = useState(role?.summary || '');
  const [scenario, setScenario] = useState(role?.scenario || '');
  const [depth, setDepth] = useState(String(role?.depth ?? ''));
  const [speakFrequency, setSpeakFrequency] = useState(String(role?.speak_frequency ?? ''));
  const [tags, setTags] = useState((role?.tags || []).join(', '));

  useEffect(() => {
    if (role) {
      setName(role.name || '');
      setAvatar(role.avatar || '');
      setDescription(role.description || '');
      setSystem(role.system_prompt || '');
      setFirst(role.first_message || '');
      setCreatorNotes(role.creator_notes || '');
      setSummary(role.summary || '');
      setScenario(role.scenario || '');
      setDepth(String(role.depth ?? ''));
      setSpeakFrequency(String(role.speak_frequency ?? ''));
      setTags((role.tags || []).join(', '));
    }
  }, [role]);

  if (!role) {
    return (
      <View style={styles.container}>
        <Text>未找到该角色。</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="titleLarge">编辑角色</Text>
      <TextInput label="名称" mode="outlined" value={name} onChangeText={setName} />
  <TextInput label="头像 URL" mode="outlined" value={avatar} onChangeText={setAvatar} placeholder="https://..." />
  {!!avatar && <Image source={{ uri: avatar }} style={styles.avatar} />}
      <TextInput label="简介" mode="outlined" value={description} onChangeText={setDescription} />
      <TextInput label="系统提示" mode="outlined" value={system} onChangeText={setSystem} multiline numberOfLines={6} />
      <TextInput label="第一条消息（first_message）" mode="outlined" value={first} onChangeText={setFirst} multiline numberOfLines={4} />

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
          await updateRole(role.id, {
            name: name.trim(),
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
          });
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

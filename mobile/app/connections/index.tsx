import { View, StyleSheet, FlatList } from 'react-native';
import { Button, List, Text } from 'react-native-paper';
import { useConnectionsStore } from '../../src/stores/connections';
import { Link } from 'expo-router';

export default function ConnectionsScreen() {
  const items = useConnectionsStore((s) => s.items);
  return (
    <View style={styles.container}>
      <Text variant="titleLarge">API 连接</Text>
      <Text>配置 OpenAI/Gemini/Claude 等提供商</Text>
      <Link href="/connections/new" asChild>
        <Button mode="contained">新建连接</Button>
      </Link>
      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/connections/[id]', params: { id: item.id } }} asChild>
            <List.Item
              title={item.name}
              description={`${item.provider}${item.isDefault ? ' · 默认' : ''}`}
              right={(props) => (item.isDefault ? <List.Icon {...props} icon="star" /> : null)}
            />
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 }
});

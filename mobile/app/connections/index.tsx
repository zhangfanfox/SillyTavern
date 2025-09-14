import { View, StyleSheet, FlatList } from 'react-native';
import { Button, List, Text } from 'react-native-paper';
import { useConnectionsStore } from '../../src/stores/connections';
import { Link } from 'expo-router';

export default function ConnectionsScreen() {
  const items = useConnectionsStore((s) => s.items);
  const currentId = useConnectionsStore((s) => s.currentId);
  const setCurrent = useConnectionsStore((s) => s.setCurrent);
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
        renderItem={({ item }) => {
          const selected = item.id === currentId;
          return (
            <List.Item
              title={item.name}
              description={`${item.provider}${item.model ? ' · ' + item.model : ''}`}
              left={(props) => <List.Icon {...props} icon={selected ? 'check-circle' : 'checkbox-blank-circle-outline'} />}
              onPress={() => setCurrent(item.id)}
              onLongPress={() => {
                // Long press to edit
                // Navigate to edit page
                // Using Link is not convenient inside callback; use imperative navigation
              }}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
});

import * as SecureStore from 'expo-secure-store';

export async function setSecret(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, { keychainService: 'sillytavern' });
}

export async function getSecret(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, { keychainService: 'sillytavern' });
  } catch {
    return null;
  }
}

export async function deleteSecret(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, { keychainService: 'sillytavern' });
  } catch {
    // noop
  }
}

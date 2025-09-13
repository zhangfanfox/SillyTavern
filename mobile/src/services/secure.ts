import * as SecureStore from 'expo-secure-store';

function sanitizeKey(key: string): string {
  const sanitized = (key || '').replace(/[^0-9A-Za-z._-]/g, '_');
  if (!sanitized) throw new Error('Invalid key');
  return sanitized;
}

export async function setSecret(key: string, value: string): Promise<void> {
  const safe = sanitizeKey(key);
  await SecureStore.setItemAsync(safe, value, { keychainService: 'sillytavern' });
}

export async function getSecret(key: string): Promise<string | null> {
  try {
    const safe = sanitizeKey(key);
    return await SecureStore.getItemAsync(safe, { keychainService: 'sillytavern' });
  } catch {
    return null;
  }
}

export async function deleteSecret(key: string): Promise<void> {
  try {
    const safe = sanitizeKey(key);
    await SecureStore.deleteItemAsync(safe, { keychainService: 'sillytavern' });
  } catch {
    // noop
  }
}

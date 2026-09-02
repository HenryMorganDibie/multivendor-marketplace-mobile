import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@platform_device_id';

/**
 * A stable per-install identifier, used to key a push token doc per device
 * (`registerPushToken`'s `deviceId`) so re-registering on the same device
 * updates one doc instead of accumulating a new one every time a token
 * refreshes. Not a hardware ID — a random value generated once and persisted
 * in AsyncStorage, which is all `registerPushToken` needs: something stable
 * for the lifetime of this app install.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

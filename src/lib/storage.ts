import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Unified cross-platform key-value storage engine.
 * Uses SecureStore on iOS/Android (hardware-encrypted keychain/keystore)
 * and localStorage with memory fallback on Web.
 */
class AppStorage {
  private memCache = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return this.memCache.get(key) ?? null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.warn(`[AppStorage] Error reading key "${key}":`, err);
      return this.memCache.get(key) ?? null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    this.memCache.set(key, value);
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.warn(`[AppStorage] Error writing key "${key}":`, err);
    }
  }

  async removeItem(key: string): Promise<void> {
    this.memCache.delete(key);
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.warn(`[AppStorage] Error removing key "${key}":`, err);
    }
  }

  async getJSON<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const raw = await this.getItem(key);
      if (!raw) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  async setJSON<T>(key: string, value: T): Promise<void> {
    try {
      await this.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[AppStorage] Error serializing key "${key}":`, err);
    }
  }
}

export const appStorage = new AppStorage();

/**
 * HPDL SDK — STORAGE POLYFILL
 *
 * The artifact uses window.storage (Claude artifact sandbox API).
 * Outside the artifact (Vercel, localhost, Node), this polyfill
 * swaps to localStorage transparently.
 *
 * Usage:
 *   import { storage } from 'hpdl-sdk';
 *   await storage.set('hpdl_config', JSON.stringify(config));
 *   const result = await storage.get('hpdl_config');
 */

export interface StorageResult {
  key:    string;
  value:  string;
  shared: boolean;
}

export interface StorageAdapter {
  get(key: string, shared?: boolean):    Promise<StorageResult | null>;
  set(key: string, value: string, shared?: boolean): Promise<StorageResult | null>;
  delete(key: string, shared?: boolean): Promise<{ key: string; deleted: boolean; shared: boolean } | null>;
  list(prefix?: string, shared?: boolean): Promise<{ keys: string[]; prefix?: string; shared: boolean } | null>;
}

// ── Detect environment ──────────────────────────────────────────
function getWindowStorage(): StorageAdapter | null {
  if (typeof window !== 'undefined' && (window as any).storage) {
    return (window as any).storage as StorageAdapter;
  }
  return null;
}

// ── localStorage adapter ────────────────────────────────────────
const localStorageAdapter: StorageAdapter = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) throw new Error(`Key not found: ${key}`);
      return { key, value, shared: false };
    } catch {
      throw new Error(`Key not found: ${key}`);
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    } catch {
      return null;
    }
  },
  async delete(key) {
    try {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    } catch {
      return null;
    }
  },
  async list(prefix) {
    try {
      const keys = Object.keys(localStorage)
        .filter(k => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared: false };
    } catch {
      return null;
    }
  },
};

// ── In-memory adapter (Node/test environments) ──────────────────
const memStore = new Map<string, string>();
const memoryAdapter: StorageAdapter = {
  async get(key) {
    if (!memStore.has(key)) throw new Error(`Key not found: ${key}`);
    return { key, value: memStore.get(key)!, shared: false };
  },
  async set(key, value) {
    memStore.set(key, value);
    return { key, value, shared: false };
  },
  async delete(key) {
    memStore.delete(key);
    return { key, deleted: true, shared: false };
  },
  async list(prefix) {
    const keys = [...memStore.keys()].filter(k => !prefix || k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};

// ── Auto-detect and export ──────────────────────────────────────
export const storage: StorageAdapter = (() => {
  const win = getWindowStorage();
  if (win) return win;
  if (typeof localStorage !== 'undefined') return localStorageAdapter;
  return memoryAdapter;
})();

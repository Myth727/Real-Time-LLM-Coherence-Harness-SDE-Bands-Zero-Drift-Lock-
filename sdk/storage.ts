/**
 * ARCHITECT — Universal Coherence Engine
 * SDK: Storage Adapter
 * Version 1.5.42
 * © 2026 Hudson & Perry Research
 *
 * Provides a unified storage interface that works both inside the Claude
 * artifact sandbox (window.storage) and in external environments
 * (localStorage, in-memory fallback).
 *
 * The Claude artifact environment uses window.storage (key-value, async).
 * Vercel/Node deployments fall back to localStorage or in-memory storage.
 */

// ── Types ─────────────────────────────────────────────────────────

export interface StorageResult {
  key: string;
  value: string;
  shared?: boolean;
}

export interface StorageAdapter {
  get(key: string, shared?: boolean): Promise<StorageResult | null>;
  set(key: string, value: string, shared?: boolean): Promise<StorageResult | null>;
  delete(key: string, shared?: boolean): Promise<{ key: string; deleted: boolean } | null>;
  list(prefix?: string, shared?: boolean): Promise<{ keys: string[] } | null>;
}

// ── In-memory fallback ─────────────────────────────────────────────

class MemoryStorage implements StorageAdapter {
  private store = new Map<string, string>();

  async get(key: string): Promise<StorageResult | null> {
    const value = this.store.get(key);
    if (value === undefined) return null;
    return { key, value };
  }

  async set(key: string, value: string): Promise<StorageResult | null> {
    this.store.set(key, value);
    return { key, value };
  }

  async delete(key: string): Promise<{ key: string; deleted: boolean } | null> {
    const deleted = this.store.delete(key);
    return { key, deleted };
  }

  async list(prefix?: string): Promise<{ keys: string[] } | null> {
    const keys = [...this.store.keys()].filter(k =>
      prefix ? k.startsWith(prefix) : true
    );
    return { keys };
  }
}

// ── localStorage adapter ───────────────────────────────────────────

class LocalStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<StorageResult | null> {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return null;
      return { key, value };
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<StorageResult | null> {
    try {
      localStorage.setItem(key, value);
      return { key, value };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<{ key: string; deleted: boolean } | null> {
    try {
      localStorage.removeItem(key);
      return { key, deleted: true };
    } catch {
      return { key, deleted: false };
    }
  }

  async list(prefix?: string): Promise<{ keys: string[] } | null> {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (!prefix || k.startsWith(prefix))) keys.push(k);
      }
      return { keys };
    } catch {
      return null;
    }
  }
}

// ── window.storage adapter (Claude artifact sandbox) ──────────────

class WindowStorageAdapter implements StorageAdapter {
  private ws = (window as unknown as { storage: StorageAdapter }).storage;

  async get(key: string, shared = false): Promise<StorageResult | null> {
    return this.ws.get(key, shared);
  }

  async set(key: string, value: string, shared = false): Promise<StorageResult | null> {
    return this.ws.set(key, value, shared);
  }

  async delete(key: string, shared = false): Promise<{ key: string; deleted: boolean } | null> {
    return this.ws.delete(key, shared);
  }

  async list(prefix?: string, shared = false): Promise<{ keys: string[] } | null> {
    return this.ws.list(prefix, shared);
  }
}

// ── Auto-detect and export the right adapter ──────────────────────

function createStorage(): StorageAdapter {
  if (typeof window !== 'undefined') {
    if ((window as unknown as { storage?: unknown }).storage) {
      return new WindowStorageAdapter();
    }
    if (typeof localStorage !== 'undefined') {
      return new LocalStorageAdapter();
    }
  }
  return new MemoryStorage();
}

export const storage: StorageAdapter = createStorage();

// ── ARCHITECT storage keys ────────────────────────────────────────
// Split into two keys to stay under 5MB per-key limit:
//   hpdl_config — settings, toggles, constants, framework mode (~small)
//   hpdl_data   — coherence data, events, RAG cache (~grows with session)

export const STORAGE_KEYS = {
  CONFIG: 'hpdl_config',
  DATA: 'hpdl_data',
} as const;

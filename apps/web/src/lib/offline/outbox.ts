import { openDB, IDBPDatabase } from 'idb';
import { API_URL, tokens } from '@/lib/api/auth';

export type OutboxItem<T = unknown> = {
  key: string;
  url: string;
  method: string;
  body: T;
  clientUpdatedAt: string;
  timestamp: number;
};

const DB_NAME = 'nutrikids-offline';
const STORE_NAME = 'outbox';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable on server'));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueOutbox<T>(item: Omit<OutboxItem<T>, 'timestamp'>): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, {
      ...item,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn('Failed to enqueue outbox mutation to IndexedDB', err);
  }
}

export async function getOutboxItems(): Promise<OutboxItem[]> {
  try {
    const db = await getDb();
    return await db.getAll(STORE_NAME);
  } catch {
    return [];
  }
}

export async function removeOutboxItem(key: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, key);
  } catch (err) {
    console.warn('Failed to remove outbox item', err);
  }
}

export async function drainOutbox(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const items = await getOutboxItems();
  const token = tokens.getAccess();

  for (const item of items) {
    try {
      const fullUrl = item.url.startsWith('http') ? item.url : `${API_URL}${item.url}`;
      const res = await fetch(fullUrl, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(item.body),
      });

      if (res.ok || res.status === 409) {
        await removeOutboxItem(item.key);
      }
    } catch {
      // Still offline or failed; keep in outbox
      break;
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    drainOutbox();
  });
}

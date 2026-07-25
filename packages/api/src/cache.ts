const DEFAULT_TTL_MS = 60_000;

interface Entry {
  value: unknown;
  expires: number;
}

const store = new Map<string, Entry>();

/** 60s in-memory cache — plenty for football-data.org's 10 req/min free tier. */
export async function cached<T>(key: string, fn: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function clearCache(): void {
  store.clear();
}

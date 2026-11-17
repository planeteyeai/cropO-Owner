/**
 * Share identical in-flight promises so Strict Mode / overlapping callers
 * do not hit the network twice for the same key.
 */
const inflight = new Map<string, Promise<unknown>>();

export function dedupeInflight<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const req = factory().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, req);
  return req;
}

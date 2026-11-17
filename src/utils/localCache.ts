import type { Farmer } from '../types/owner';
import type { ShipmentListItem } from '../types/shipment';

const PREFIX = 'owner_cropo_cache:';

export const CACHE_TTL = {
  /** Django farmer profile */
  farmer: 30 * 60 * 1000,
  /** FastAPI manager-dashboard field report */
  report: 20 * 60 * 1000,
  /** Django owner farmer list (search + page) */
  farmerList: 15 * 60 * 1000,
  /** Django owner shipment list */
  shipmentList: 15 * 60 * 1000,
  /** Django owner shipment detail */
  shipment: 30 * 60 * 1000,
} as const;

interface CacheEnvelope<T> {
  savedAt: number;
  ttlMs: number;
  data: T;
}

function fullKey(key: string): string {
  return `${PREFIX}${key}`;
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(fullKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== 'number' || parsed.data === undefined) {
      localStorage.removeItem(fullKey(key));
      return null;
    }
    if (Date.now() - parsed.savedAt > (parsed.ttlMs || 0)) {
      localStorage.removeItem(fullKey(key));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Stale-while-revalidate read: returns cached data even after TTL expiry.
 * Does not delete the entry — caller can paint immediately and refetch in background.
 */
export function cacheGetFreshOrStale<T>(
  key: string,
): { data: T; stale: boolean; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(fullKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== 'number' || parsed.data === undefined) {
      localStorage.removeItem(fullKey(key));
      return null;
    }
    const ttl = parsed.ttlMs || 0;
    const stale = Date.now() - parsed.savedAt > ttl;
    return { data: parsed.data, stale, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  const envelope: CacheEnvelope<T> = {
    savedAt: Date.now(),
    ttlMs,
    data,
  };
  const payload = JSON.stringify(envelope);
  try {
    localStorage.setItem(fullKey(key), payload);
  } catch {
    // Quota exceeded — drop oldest owner_cropo cache entries and retry once
    try {
      clearExpiredCache();
      pruneOldestCacheEntries(8);
      localStorage.setItem(fullKey(key), payload);
    } catch {
      /* ignore — app still works without cache */
    }
  }
}

export function cacheRemove(key: string): void {
  try {
    localStorage.removeItem(fullKey(key));
  } catch {
    /* ignore */
  }
}

export function clearExpiredCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    const now = Date.now();
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as CacheEnvelope<unknown>;
        if (!parsed?.savedAt || now - parsed.savedAt > (parsed.ttlMs || 0)) {
          localStorage.removeItem(k);
        }
      } catch {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

function pruneOldestCacheEntries(count: number): void {
  try {
    const entries: Array<{ key: string; savedAt: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as CacheEnvelope<unknown>;
        entries.push({ key: k, savedAt: parsed.savedAt || 0 });
      } catch {
        entries.push({ key: k, savedAt: 0 });
      }
    }
    entries.sort((a, b) => a.savedAt - b.savedAt);
    for (const e of entries.slice(0, count)) {
      localStorage.removeItem(e.key);
    }
  } catch {
    /* ignore */
  }
}

export function farmerCacheKey(farmerId: string | number): string {
  return `farmer:${farmerId}`;
}

export function reportCacheKey(mobile: string, date?: string): string {
  const m = mobile.replace(/\D/g, '').slice(-10);
  return date ? `report:${m}:${date}` : `report:${m}`;
}

export function farmerListCacheKey(search: string, page: number, pageSize: number): string {
  const q = search.trim().toLowerCase();
  return `farmerList:p${page}:s${pageSize}:q=${encodeURIComponent(q)}`;
}

export interface FarmerListCachePayload {
  data: Farmer[];
  count: number;
  next: string | null;
  previous: string | null;
}

export function shipmentListCacheKey(
  search: string,
  type: string,
  page: number,
  pageSize: number,
): string {
  const q = search.trim().toLowerCase();
  return `shipmentList:t=${encodeURIComponent(type)}:p${page}:s${pageSize}:q=${encodeURIComponent(q)}`;
}

export function shipmentCacheKey(recordType: string, recordId: string | number): string {
  return `shipment:${recordType}:${recordId}`;
}

export interface ShipmentListCachePayload {
  data: ShipmentListItem[];
  count: number;
  next: string | null;
  previous: string | null;
}

/** Find a farmer stub from any cached list page (for instant detail header). */
export function findCachedListFarmer(farmerId: string | number): Farmer | null {
  const id = String(farmerId);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(`${PREFIX}farmerList:`)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        savedAt?: number;
        ttlMs?: number;
        data?: FarmerListCachePayload;
      };
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > (parsed.ttlMs || 0)) continue;
      const hit = parsed.data?.data?.find((f) => String(f.id) === id);
      if (hit) return hit;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Find a shipment from any cached list page. */
export function findCachedListShipment(
  recordType: string,
  recordId: string | number,
): ShipmentListItem | null {
  const id = String(recordId);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(`${PREFIX}shipmentList:`)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        savedAt?: number;
        ttlMs?: number;
        data?: ShipmentListCachePayload;
      };
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > (parsed.ttlMs || 0)) continue;
      const hit = parsed.data?.data?.find(
        (s) => s.record_type === recordType && String(s.id) === id,
      );
      if (hit) return hit;
    }
  } catch {
    /* ignore */
  }
  return null;
}

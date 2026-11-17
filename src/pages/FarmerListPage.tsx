import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, getFarmer, listFarmers } from '../api/ownerApi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { Farmer, FarmerListResponse } from '../types/owner';
import { asFarmer, asFarmerListPayload } from '../utils/apiGuards';
import { farmerDisplayName, farmerInitials } from '../utils/farmerName';
import { dedupeInflight } from '../utils/inflight';
import {
  CACHE_TTL,
  cacheGet,
  cacheRemove,
  cacheSet,
  farmerCacheKey,
  farmerListCacheKey,
  type FarmerListCachePayload,
} from '../utils/localCache';

const PAGE_SIZE = 20;
const prefetchInFlight = new Set<string>();

function locationLabel(f: Farmer): string {
  const parts = [f.village, f.district].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function prefetchFarmer(id: number): void {
  const key = String(id);
  if (prefetchInFlight.has(key)) return;
  if (cacheGet<Farmer>(farmerCacheKey(id))) return;
  prefetchInFlight.add(key);
  void getFarmer(id)
    .then((data) => {
      const farmer = asFarmer(data);
      if (farmer) cacheSet(farmerCacheKey(id), farmer, CACHE_TTL.farmer);
    })
    .catch(() => {
      /* ignore prefetch errors */
    })
    .finally(() => {
      prefetchInFlight.delete(key);
    });
}

function fetchFarmerList(
  cacheKey: string,
  search: string,
  page: number,
): Promise<FarmerListResponse> {
  return dedupeInflight(cacheKey, () =>
    listFarmers({
      search,
      page,
      page_size: PAGE_SIZE,
    }),
  );
}

const FarmerRow = memo(function FarmerRow({
  farmer,
  onOpen,
}: {
  farmer: Farmer;
  onOpen: (f: Farmer) => void;
}) {
  const onClick = useCallback(() => onOpen(farmer), [farmer, onOpen]);
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen(farmer);
      }
    },
    [farmer, onOpen],
  );
  const onPrefetch = useCallback(() => prefetchFarmer(farmer.id), [farmer.id]);

  return (
    <tr
      className="clickable-row"
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="link"
    >
      <td>
        <div className="farmer-cell">
          <span className="farmer-avatar">{farmerInitials(farmer)}</span>
          <Link
            to={`/farmers/${farmer.id}`}
            state={{ farmer }}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={onPrefetch}
          >
            {farmerDisplayName(farmer)}
          </Link>
        </div>
      </td>
      <td className="mono">{farmer.phone_number || '—'}</td>
      <td>{locationLabel(farmer)}</td>
      <td>
        <span className="plot-count">{farmer.plot_count ?? farmer.plots?.length ?? 0}</span>
      </td>
    </tr>
  );
});

export function FarmerListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [searchForPage, setSearchForPage] = useState(debouncedSearch);
  if (searchForPage !== debouncedSearch) {
    setSearchForPage(debouncedSearch);
    setPage(1);
  }

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const softRefreshRef = useRef(false);
  const hardRefreshRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const softRefresh = softRefreshRef.current;
    const hardRefresh = hardRefreshRef.current;
    softRefreshRef.current = false;
    hardRefreshRef.current = false;

    const effectivePage = searchForPage !== debouncedSearch ? 1 : page;
    const cacheKey = farmerListCacheKey(debouncedSearch, effectivePage, PAGE_SIZE);

    async function load() {
      setError(null);

      if (hardRefresh) cacheRemove(cacheKey);

      const cachedRaw = hardRefresh ? null : cacheGet<FarmerListCachePayload>(cacheKey);
      const cached = cachedRaw ? asFarmerListPayload(cachedRaw) : null;
      if (cached) {
        setFarmers(cached.data);
        setCount(cached.count);
        setLoading(false);
        if (!softRefresh && !hardRefresh) return;
      } else {
        // Keep existing rows visible while refetching / loading a new page
        setLoading(true);
      }

      try {
        const res = await fetchFarmerList(cacheKey, debouncedSearch, effectivePage);
        if (cancelled) return;
        const payload = asFarmerListPayload(res);
        if (!payload) {
          setError('Farmers response was incomplete.');
          return;
        }
        setFarmers(payload.data);
        setCount(payload.count);
        cacheSet(cacheKey, payload, CACHE_TTL.farmerList);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) setError(err.message);
        else setError('Failed to load farmers.');
        // Never wipe existing UI on refetch failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, refreshTick, searchForPage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(count / PAGE_SIZE)),
    [count],
  );
  // Never stay past the last page (e.g. after search shrinks results)
  if (page > totalPages) {
    setPage(totalPages);
  }

  const initialLoading = loading && farmers.length === 0;
  const refreshing = loading && farmers.length > 0;
  const canGoPrev = page > 1 && !(loading && farmers.length === 0);
  const canGoNext = page < totalPages && !(loading && farmers.length === 0);

  const openFarmer = useCallback(
    (f: Farmer) => {
      navigate(`/farmers/${f.id}`, { state: { farmer: f } });
    },
    [navigate],
  );

  const onRefreshClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    if (e.shiftKey) hardRefreshRef.current = true;
    else softRefreshRef.current = true;
    setRefreshTick((t) => t + 1);
  }, []);

  const onSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const goPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(
    () => setPage((p) => Math.min(totalPages, p + 1)),
    [totalPages],
  );

  return (
    <div className="page fade-in">
      <div className="dash-banner">
        <div>
          <p className="dash-eyebrow">CropO Owner Dashboard</p>
          <h1>Farmers</h1>
          <p className="muted">Search farmers and open a profile to view plots and crops.</p>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{count.toLocaleString()}</span>
          <span className="stat-label">Farmers</span>
        </div>
      </div>

      <div className="toolbar panel-surface">
        <div className="search-wrap">
          <span className="search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            className="search-input"
            type="search"
            placeholder="Search by mobile number or name"
            value={search}
            onChange={onSearchChange}
            aria-label="Search farmers"
          />
        </div>
        <div className="toolbar-actions">
          {refreshing ? <span className="toolbar-status">Updating…</span> : null}
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            disabled={loading && farmers.length === 0}
            title="Refresh (Shift+click to force bypass cache)"
            onClick={onRefreshClick}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className={`table-wrap ${refreshing ? 'table-wrap-refreshing' : ''}`}>
        <table className="data-table" aria-busy={loading || undefined}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Village / District</th>
              <th>Plots</th>
            </tr>
          </thead>
          <tbody>
            {initialLoading ? (
              <tr>
                <td colSpan={4} className="empty-cell">
                  <span className="inline-loading">
                    <span className="loading-spinner" aria-hidden="true">
                      <span className="loading-spinner-dot" />
                    </span>
                    Loading farmers…
                  </span>
                </td>
              </tr>
            ) : farmers.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-cell">
                  No farmers found.
                </td>
              </tr>
            ) : (
              farmers.map((f) => <FarmerRow key={f.id} farmer={f} onOpen={openFarmer} />)
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canGoPrev}
          onClick={goPrev}
        >
          Previous
        </button>
        <span className="page-indicator">
          Page {Math.min(page, totalPages)} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canGoNext}
          onClick={goNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}

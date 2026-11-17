import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, listShipments } from '../api/ownerApi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type {
  ShipmentListItem,
  ShipmentListResponse,
  ShipmentRecordType,
} from '../types/shipment';
import { asShipmentListPayload } from '../utils/apiGuards';
import { formatNum } from '../utils/farmerName';
import { dedupeInflight } from '../utils/inflight';
import {
  CACHE_TTL,
  cacheGet,
  cacheRemove,
  cacheSet,
  shipmentCacheKey,
  shipmentListCacheKey,
  type ShipmentListCachePayload,
} from '../utils/localCache';

const PAGE_SIZE = 20;

type TypeFilter = 'all' | ShipmentRecordType;

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (['accepted', 'completed'].includes(s)) return 'status-good';
  if (['pending', 'quoted', 'awaiting_confirmation'].includes(s)) return 'status-mid';
  if (['rejected', 'cancelled'].includes(s)) return 'status-low';
  return '';
}

function prettyStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

function priceLabel(item: ShipmentListItem): string {
  const value =
    item.final_price ?? item.confirmed_price ?? item.estimated_price ?? item.original_price;
  if (value == null || value === '') return '—';
  return `₹${formatNum(Number(value), 0)}`;
}

function fetchShipmentList(
  cacheKey: string,
  search: string,
  type: TypeFilter,
  page: number,
): Promise<ShipmentListResponse> {
  return dedupeInflight(cacheKey, () =>
    listShipments({
      search,
      type,
      page,
      page_size: PAGE_SIZE,
    }),
  );
}

export function ShipmentListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);
  const [filterKey, setFilterKey] = useState(`${debouncedSearch}::${typeFilter}`);
  const nextFilterKey = `${debouncedSearch}::${typeFilter}`;
  if (filterKey !== nextFilterKey) {
    setFilterKey(nextFilterKey);
    setPage(1);
  }

  const [items, setItems] = useState<ShipmentListItem[]>([]);
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

    const effectivePage = filterKey !== nextFilterKey ? 1 : page;
    const cacheKey = shipmentListCacheKey(
      debouncedSearch,
      typeFilter,
      effectivePage,
      PAGE_SIZE,
    );

    async function load() {
      setError(null);

      if (hardRefresh) cacheRemove(cacheKey);

      const cachedRaw = hardRefresh ? null : cacheGet<ShipmentListCachePayload>(cacheKey);
      const cached = cachedRaw ? asShipmentListPayload(cachedRaw) : null;
      if (cached) {
        setItems(cached.data);
        setCount(cached.count);
        setLoading(false);
        if (!softRefresh && !hardRefresh) return;
      } else {
        // Keep existing cards visible while refetching
        setLoading(true);
      }

      try {
        const res = await fetchShipmentList(
          cacheKey,
          debouncedSearch,
          typeFilter,
          effectivePage,
        );
        if (cancelled) return;
        const payload = asShipmentListPayload(res);
        if (!payload) {
          setError('Shipments response was incomplete.');
          return;
        }
        setItems(payload.data);
        setCount(payload.count);
        cacheSet(cacheKey, payload, CACHE_TTL.shipmentList);
        for (const item of payload.data) {
          const dKey = shipmentCacheKey(item.record_type, item.id);
          if (!cacheGet(dKey)) {
            cacheSet(dKey, item, CACHE_TTL.shipment);
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) setError(err.message);
        else setError('Failed to load shipment records.');
        // Never wipe existing UI on refetch failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, typeFilter, page, refreshTick, filterKey, nextFilterKey]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / PAGE_SIZE)), [count]);
  // Never stay past the last page (e.g. after filters shrink results)
  if (page > totalPages) {
    setPage(totalPages);
  }

  const initialLoading = loading && items.length === 0;
  const refreshing = loading && items.length > 0;
  const canGoPrev = page > 1 && !(loading && items.length === 0);
  const canGoNext = page < totalPages && !(loading && items.length === 0);

  const onRefreshClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    if (e.shiftKey) hardRefreshRef.current = true;
    else softRefreshRef.current = true;
    setRefreshTick((t) => t + 1);
  }, []);

  const onSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const openShipment = useCallback(
    (item: ShipmentListItem) => {
      navigate(`/shipments/${item.record_type}/${item.id}`, {
        state: { shipment: item },
      });
    },
    [navigate],
  );

  const goPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(
    () => setPage((p) => Math.min(totalPages, p + 1)),
    [totalPages],
  );

  return (
    <div className="page fade-in">
      <div className="dash-banner">
        <div>
          <p className="dash-eyebrow">Shipment records</p>
          <h1>Requests</h1>
          <p className="muted">Warehouse rack bookings and farmer transport requests.</p>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{count.toLocaleString()}</span>
          <span className="stat-label">Records</span>
        </div>
      </div>

      <div className="toolbar panel-surface shipment-toolbar">
        <div className="search-wrap">
          <span className="search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            className="search-input"
            type="search"
            placeholder="Search farmer, phone, warehouse, vehicle, crop"
            value={search}
            onChange={onSearchChange}
            aria-label="Search shipments"
          />
        </div>
        <div className="filter-chips" role="tablist" aria-label="Record type">
          {(
            [
              ['all', 'All'],
              ['transport', 'Transport'],
              ['warehouse', 'Warehouse'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`filter-chip ${typeFilter === value ? 'active' : ''}`}
              onClick={() => setTypeFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          {refreshing ? <span className="toolbar-status">Updating…</span> : null}
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            disabled={loading && items.length === 0}
            title="Refresh (Shift+click to force bypass cache)"
            onClick={onRefreshClick}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className={`shipment-grid ${refreshing ? 'table-wrap-refreshing' : ''}`}>
        {initialLoading ? (
          <div className="empty-panel">
            <span className="inline-loading">
              <span className="loading-spinner" aria-hidden="true">
                <span className="loading-spinner-dot" />
              </span>
              Loading shipment records…
            </span>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-panel">No shipment records found.</div>
        ) : (
          items.map((item) => (
            <button
              key={item.record_key}
              type="button"
              className="shipment-card"
              onClick={() => openShipment(item)}
            >
              <div className="shipment-card-top">
                <span className={`type-badge type-${item.record_type}`}>
                  {item.record_type === 'transport' ? 'Transport' : 'Warehouse'}
                </span>
                <span className={`status-pill ${statusClass(item.status)}`}>
                  {prettyStatus(item.status)}
                </span>
              </div>
              <h3>{item.farmer_name || 'Unknown farmer'}</h3>
              <p className="shipment-phone mono">{item.farmer_phone || '—'}</p>
              <div className="shipment-meta">
                <span>
                  {item.record_type === 'transport'
                    ? item.provider_name || item.vehicle_number || 'Transport provider'
                    : item.provider_name || item.rack_code || 'Warehouse'}
                </span>
                <span>{item.crop_name || '—'}</span>
              </div>
              <div className="shipment-card-foot">
                <span>{item.created_at?.slice(0, 10) || item.booking_date || '—'}</span>
                <strong>{priceLabel(item)}</strong>
              </div>
            </button>
          ))
        )}
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

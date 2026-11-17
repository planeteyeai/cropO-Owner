import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiError, getShipment } from '../api/ownerApi';
import type { ShipmentListItem, ShipmentRecordType } from '../types/shipment';
import { asShipment } from '../utils/apiGuards';
import { formatNum } from '../utils/farmerName';
import { dedupeInflight } from '../utils/inflight';
import {
  CACHE_TTL,
  cacheGet,
  cacheRemove,
  cacheSet,
  findCachedListShipment,
  shipmentCacheKey,
} from '../utils/localCache';

function fetchShipmentDeduped(
  recordType: ShipmentRecordType,
  id: string,
): Promise<ShipmentListItem> {
  return dedupeInflight(`shipment:${recordType}:${id}`, async () => {
    const raw = await getShipment(recordType, id);
    const item = asShipment(raw);
    if (!item) throw new ApiError('Invalid shipment response from server.', 502);
    return item;
  });
}

function prettyStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (['accepted', 'completed'].includes(s)) return 'status-good';
  if (['pending', 'quoted', 'awaiting_confirmation'].includes(s)) return 'status-mid';
  if (['rejected', 'cancelled'].includes(s)) return 'status-low';
  return '';
}

function money(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—';
  return `₹${formatNum(Number(value), 0)}`;
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv-row">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

type LocationState = { shipment?: ShipmentListItem };

export function ShipmentDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const location = useLocation();
  const navSeed = (location.state as LocationState | null)?.shipment ?? null;

  const [item, setItem] = useState<ShipmentListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const softRefreshRef = useRef(false);
  const hardRefreshRef = useRef(false);

  useEffect(() => {
    if (!type || !id) return;
    const recordType = type as ShipmentRecordType;
    if (recordType !== 'transport' && recordType !== 'warehouse') {
      setError('Invalid shipment type.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const softRefresh = softRefreshRef.current;
    const hardRefresh = hardRefreshRef.current;
    softRefreshRef.current = false;
    hardRefreshRef.current = false;
    const cacheKey = shipmentCacheKey(recordType, id);

    async function load() {
      setError(null);
      if (hardRefresh) cacheRemove(cacheKey);

      const shipmentId = id!;
      const cachedRaw = hardRefresh ? null : cacheGet<ShipmentListItem>(cacheKey);
      const cached = cachedRaw ? asShipment(cachedRaw) : null;
      const listSeedRaw =
        !hardRefresh && navSeed?.record_type === recordType && String(navSeed.id) === String(shipmentId)
          ? navSeed
          : !hardRefresh
            ? findCachedListShipment(recordType, shipmentId)
            : null;
      const listSeed = listSeedRaw ? asShipment(listSeedRaw) : null;
      const seed = cached ?? listSeed;

      if (seed) {
        setItem(seed);
        setLoading(false);
        // Fresh cache and not refreshing → skip network
        if (cached && !softRefresh && !hardRefresh) return;
      } else if (softRefresh) {
        setLoading(false);
      } else {
        setLoading(true);
        setItem((prev) =>
          prev && prev.record_type === recordType && String(prev.id) === String(shipmentId)
            ? prev
            : null,
        );
      }

      try {
        const data = await fetchShipmentDeduped(recordType, shipmentId);
        if (cancelled) return;
        const ok = asShipment(data);
        if (!ok) {
          setError('Shipment response was incomplete.');
          return;
        }
        setItem(ok);
        setError(null);
        cacheSet(cacheKey, ok, CACHE_TTL.shipment);
      } catch (err) {
        if (cancelled) return;
        if (!seed) {
          if (err instanceof ApiError) setError(err.message);
          else setError('Failed to load shipment record.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [type, id, refreshTick, navSeed]);

  if (loading && !item) {
    return (
      <div className="page fade-in">
        <p className="muted">Loading shipment…</p>
      </div>
    );
  }

  if (!item && !loading) {
    return (
      <div className="page fade-in">
        <Link to="/shipments" className="back-link">
          ← Back to shipments
        </Link>
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          {error || 'Shipment not found.'}
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page fade-in">
        <p className="muted">Loading shipment…</p>
      </div>
    );
  }

  const isTransport = item.record_type === 'transport';

  return (
    <div className="page fade-in">
      <div className="detail-topbar">
        <Link to="/shipments" className="back-link">
          ← Back to shipments
        </Link>
        <button
          type="button"
          className="btn btn-secondary btn-compact"
          disabled={loading && !item}
          title="Refresh (Shift+click to force bypass cache)"
          onClick={(e: MouseEvent<HTMLButtonElement>) => {
            if (e.shiftKey) hardRefreshRef.current = true;
            else softRefreshRef.current = true;
            setRefreshTick((t) => t + 1);
          }}
        >
          {loading && item ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? (
        <div className="loading-card loading-card-inline">
          <p>Refreshing shipment…</p>
          <span>Showing saved record while fetching the latest</span>
        </div>
      ) : null}

      <header className="detail-banner">
        <div>
          <p className="dash-eyebrow">{isTransport ? 'Transport request' : 'Warehouse request'}</p>
          <h1>{item.farmer_name || 'Shipment record'}</h1>
          <p className="detail-meta">
            <span className="mono">{item.farmer_phone || '—'}</span>
            <span className={`status-pill ${statusClass(item.status)}`}>
              {prettyStatus(item.status)}
            </span>
          </p>
        </div>
        <div className="stat-tile">
          <span className="stat-value stat-value-sm">#{item.id}</span>
          <span className="stat-label">{isTransport ? 'Transport' : 'Warehouse'}</span>
        </div>
      </header>

      <div className="detail-panels shipment-detail-panels">
        <section className="info-card info-card-growth">
          <div className="info-card-head">
            <span className="info-card-dot" aria-hidden="true" />
            <h3>Farmer</h3>
          </div>
          <div className="info-card-body">
            <Kv label="Name" value={item.farmer_name} />
            <Kv label="Mobile" value={item.farmer_phone} />
            <Kv label="Crop" value={item.crop_name || '—'} />
            <Kv label="Batch" value={item.batch_id || '—'} />
          </div>
        </section>

        <section className="info-card info-card-moisture">
          <div className="info-card-head">
            <span className="info-card-dot" aria-hidden="true" />
            <h3>{isTransport ? 'Transport provider' : 'Warehouse'}</h3>
          </div>
          <div className="info-card-body">
            <Kv label="Name" value={item.provider_name || '—'} />
            {isTransport ? (
              <>
                <Kv label="Vehicle" value={item.vehicle_number || '—'} />
                <Kv label="Category" value={item.vehicle_category || '—'} />
                <Kv label="Provider type" value={item.provider_type || '—'} />
              </>
            ) : (
              <>
                <Kv label="Rack" value={item.rack_code || '—'} />
                <Kv
                  label="Quantity"
                  value={
                    item.quantity_tons != null ? `${formatNum(Number(item.quantity_tons))} t` : '—'
                  }
                />
                <Kv
                  label="Duration"
                  value={item.duration_days != null ? `${item.duration_days} days` : '—'}
                />
              </>
            )}
          </div>
        </section>

        <section className="info-card info-card-weather">
          <div className="info-card-head">
            <span className="info-card-dot" aria-hidden="true" />
            <h3>Schedule & price</h3>
          </div>
          <div className="info-card-body">
            {isTransport ? (
              <>
                <Kv label="Booking date" value={item.booking_date || '—'} />
                <Kv label="Start" value={item.start_time || '—'} />
                <Kv label="End" value={item.end_time || '—'} />
                <Kv label="Pickup" value={item.pickup_location || '—'} />
                <Kv label="Destination" value={item.destination_location || '—'} />
                <Kv
                  label="Distance"
                  value={item.distance_km != null ? `${item.distance_km} km` : '—'}
                />
                <Kv label="Final price" value={money(item.final_price)} />
                <Kv label="Original price" value={money(item.original_price)} />
              </>
            ) : (
              <>
                <Kv label="Start date" value={item.start_date || '—'} />
                <Kv label="End date" value={item.end_date || '—'} />
                <Kv label="Confirmed price" value={money(item.confirmed_price)} />
                <Kv label="Estimated price" value={money(item.estimated_price)} />
                <Kv
                  label="Requested"
                  value={item.created_at?.slice(0, 19).replace('T', ' ') || '—'}
                />
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

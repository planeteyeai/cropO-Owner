import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getManagerDashboard, normalizeMobile } from '../api/managerDashboardApi';
import { ApiError, getFarmer } from '../api/ownerApi';
import { PlotTileMap } from '../components/PlotTileMap';
import type { ManagerDashboardResponse, ManagerPlot } from '../types/managerDashboard';
import type { Farmer, Plot as FarmerPlot } from '../types/owner';
import { asFarmer, asManagerDashboard } from '../utils/apiGuards';
import {
  farmerDisplayName,
  farmerInitials,
  formatLastLoginParts,
  formatNum,
  formatPct,
} from '../utils/farmerName';
import { dedupeInflight } from '../utils/inflight';
import {
  CACHE_TTL,
  cacheGet,
  cacheGetFreshOrStale,
  cacheRemove,
  cacheSet,
  farmerCacheKey,
  findCachedListFarmer,
  reportCacheKey,
} from '../utils/localCache';
import { matchFarmerPlot } from '../utils/plotTiles';

type LocationState = { farmer?: Farmer };

function fetchFarmerDeduped(id: string): Promise<Farmer> {
  return dedupeInflight(`farmer:${id}`, async () => {
    const raw = await getFarmer(id);
    const farmer = asFarmer(raw);
    if (!farmer) throw new ApiError('Invalid farmer response from server.', 502);
    return farmer;
  });
}

function fetchReportDeduped(mobile: string): Promise<ManagerDashboardResponse> {
  return dedupeInflight(`report:${mobile}`, async () => {
    const raw = await getManagerDashboard(mobile);
    const report = asManagerDashboard(raw);
    if (!report) throw new ApiError('Invalid field report response from server.', 502);
    return report;
  });
}

function safeFarmer(value: unknown): Farmer | null {
  return asFarmer(value);
}

function safeReport(value: unknown): ManagerDashboardResponse | null {
  return asManagerDashboard(value);
}

function scoreClass(score: number | null | undefined): string {
  if (score == null) return '';
  if (score >= 80) return 'score-good';
  if (score >= 60) return 'score-mid';
  return 'score-low';
}

function pctValue(value: number | null | undefined): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  return Math.max(0, Math.min(100, Number(value)));
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {hint ? <span className="metric-hint">{hint}</span> : null}
    </div>
  );
}

function ProgressRow({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  // Only render when the API sent a numeric value — no fake 0% bars/colors
  if (value == null || Number.isNaN(Number(value))) return null;
  const pct = pctValue(value);
  return (
    <div className="progress-row">
      <div className="progress-row-top">
        <span>{label}</span>
        <strong>{formatPct(value)}</strong>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InfoCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'growth' | 'moisture' | 'water' | 'pest' | 'fertilizer' | 'weather';
  children: ReactNode;
}) {
  return (
    <section className={`info-card info-card-${tone}`}>
      <div className="info-card-head">
        <span className="info-card-dot" aria-hidden="true" />
        <h3>{title}</h3>
      </div>
      <div className="info-card-body">{children}</div>
    </section>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function cropsForPlot(farmer: Farmer | null | undefined, plot: FarmerPlot) {
  if (!farmer?.crops?.length) return [];
  const fieldId = String(plot.field_id ?? plot.id ?? '').trim();
  if (!fieldId) return farmer.crops;
  return farmer.crops.filter((c) => String(c.field_id ?? '').trim() === fieldId);
}

function LoadingSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="loading-spinner" role="status" aria-label={label}>
      <span className="loading-spinner-dot" aria-hidden="true" />
    </span>
  );
}

/** Basic Django plots/crops — shown immediately; FastAPI enriches later. */
function DjangoPlotsPanel({
  farmer,
  selectedName,
  onSelect,
  reportLoading,
}: {
  farmer: Farmer;
  selectedName: string | null;
  onSelect: (name: string) => void;
  reportLoading?: boolean;
}) {
  const plots = farmer.plots ?? [];
  if (plots.length === 0) {
    return <p className="muted">No plots registered for this farmer yet.</p>;
  }

  const active =
    plots.find((p) => (p.name || String(p.id)) === selectedName) ?? plots[0] ?? null;
  const crops = active ? cropsForPlot(farmer, active) : [];

  return (
    <div className="django-plots fade-in">
      <div className="plot-tabs" role="tablist" aria-label="Registered plots">
        {plots.map((p) => {
          const name = p.name || String(p.id);
          const activeTab = (active?.id ?? null) === p.id;
          const cropLabel = cropsForPlot(farmer, p)
            .map((c) => [c.crop_type_name, c.crop_variety_name].filter(Boolean).join(' · '))
            .filter(Boolean)[0];
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={activeTab}
              className={`plot-tab-card ${activeTab ? 'active' : ''} ${reportLoading ? 'plot-tab-loading' : ''}`}
              onClick={() => onSelect(name)}
            >
              <span className="plot-tab-name">{name}</span>
              <span className="plot-tab-crop">{cropLabel || 'Registered plot'}</span>
              <span className="plot-tab-score">
                {reportLoading ? <LoadingSpinner label="Loading field report" /> : '—'}
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className={`plot-report fade-in ${reportLoading ? 'plot-report-loading' : ''}`}>
          <div className="plot-hero-card">
            <div className="plot-hero-main">
              <p className="dash-eyebrow">Registered plot</p>
              <h2>{active.name || `Plot ${active.id}`}</h2>
              <p className="plot-hero-sub">
                {crops
                  .map((c) => [c.crop_type_name, c.crop_variety_name].filter(Boolean).join(' · '))
                  .filter(Boolean)
                  .join(', ') || 'Crop details from farmer profile'}
              </p>
              <div className="chip-row">
                <span className="soft-chip">From Django</span>
                {active.field_id ? <span className="soft-chip mono">{active.field_id}</span> : null}
              </div>
            </div>
            {reportLoading ? (
              <div className="plot-loading-badge">
                <LoadingSpinner label="Loading field data" />
                <span>Loading field data…</span>
              </div>
            ) : null}
          </div>

          {reportLoading ? (
            <div className="plot-loading-panel" aria-busy="true">
              <LoadingSpinner label="Loading growth, moisture, water, pest" />
              <p>Fetching growth, moisture, water, pest & tiles…</p>
            </div>
          ) : (
            <div className="detail-panels">
              {crops.length === 0 ? (
                <p className="muted">No crops linked to this plot.</p>
              ) : (
                crops.map((c) => (
                  <InfoCard key={c.id} title={c.crop_type_name || `Crop #${c.id}`} tone="growth">
                    <Kv label="Variety" value={c.crop_variety_name || '—'} />
                    <Kv label="Plantation" value={c.plantation_date || '—'} />
                    <Kv label="Irrigation" value={c.irrigation_type_name || '—'} />
                    <Kv label="Soil" value={c.soil_type || '—'} />
                    <Kv label="Harvest" value={c.harvest_date || '—'} />
                  </InfoCard>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlotReport({
  plot,
  farmerPlot,
}: {
  plot: ManagerPlot;
  farmerPlot?: FarmerPlot | null;
}) {
  const report = plot.daily_report;
  const growth = report?.growth?.pixel_summary;
  const moisture = report?.soil_moisture?.pixel_summary;
  const water = report?.water_uptake?.pixel_summary;
  const pest = report?.pest_detection?.pixel_summary;
  const agro = report?.agro_stats;
  const npk = report?.npk_analysis;
  const weather = report?.current_weather;
  const irrigation = plot.irrigation_and_soil_moisture;
  const score = plot.field_score?.field_score ?? null;
  const crop = plot.crop_details;
  const forecast = Array.isArray(report?.forecast) ? report.forecast.slice(0, 5) : [];

  return (
    <div className="plot-report fade-in">
      <div className="plot-hero-card">
        <div className="plot-hero-main">
          <p className="dash-eyebrow">Selected plot</p>
          <h2>Plot {plot.plot_name || '—'}</h2>
          <p className="plot-hero-sub">
            {[crop?.crop_type, crop?.crop_variety].filter(Boolean).join(' · ') ||
              'Crop details unavailable'}
          </p>
          <div className="chip-row">
            {crop?.irrigation_type ? <span className="soft-chip">{crop.irrigation_type}</span> : null}
            {agro?.current_growth_stage ? (
              <span className="soft-chip">{agro.current_growth_stage}</span>
            ) : null}
            {agro?.eligibility_status ? (
              <span className="soft-chip">{agro.eligibility_status}</span>
            ) : null}
          </div>
        </div>
        <div className={`score-badge ${scoreClass(score)}`}>
          <span className="score-num">{score != null ? formatNum(score, 0) : '—'}</span>
          <span className="score-lbl">Field score</span>
        </div>
      </div>

      <PlotTileMap plot={plot} farmerPlot={farmerPlot} />

      <div className="metric-grid">
        <MetricCard
          label="Area"
          value={agro?.area_acres != null ? `${formatNum(agro.area_acres)} ac` : '—'}
          hint="Plot size"
        />
        <MetricCard
          label="Days to harvest"
          value={agro?.days_to_harvest != null ? String(agro.days_to_harvest) : '—'}
          hint="From report"
        />
        <MetricCard
          label="Plantation"
          value={crop?.plantation_date || agro?.plantation_date || '—'}
          hint={agro?.plantation_type || 'Date'}
        />
        <MetricCard
          label="Soil moisture"
          value={
            irrigation?.final_soil_moisture_capped != null
              ? `${formatNum(irrigation.final_soil_moisture_capped)}%`
              : '—'
          }
          hint="Final capped"
        />
        <MetricCard
          label="Healthy growth"
          value={formatPct(growth?.healthy_pixel_percentage)}
          hint="NDVI pixels"
        />
        <MetricCard
          label="Biomass"
          value={agro?.biomass?.mean != null ? formatNum(agro.biomass.mean) : '—'}
          hint="Mean"
        />
      </div>

      <div className="detail-panels">
        <InfoCard title="Crop growth" tone="growth">
          <ProgressRow label="Healthy" value={growth?.healthy_pixel_percentage} />
          <ProgressRow label="Moderate" value={growth?.moderate_pixel_percentage} />
          <ProgressRow label="Weak" value={growth?.weak_pixel_percentage} />
          <ProgressRow label="Stress" value={growth?.stress_pixel_percentage} />
          {report?.growth?.latest_image_date ? (
            <Kv label="Image date" value={report.growth.latest_image_date} />
          ) : null}
        </InfoCard>

        <InfoCard title="Soil moisture" tone="moisture">
          <ProgressRow label="Excellent" value={moisture?.excellent_pixel_percentage} />
          <ProgressRow label="Adequate" value={moisture?.adequate_pixel_percentage} />
          <ProgressRow label="Less" value={moisture?.less_pixel_percentage} />
          <ProgressRow label="Excess" value={moisture?.excess_pixel_percentage} />
          {irrigation?.final_soil_moisture_capped != null ? (
            <Kv
              label="Final moisture"
              value={`${formatNum(irrigation.final_soil_moisture_capped)}%`}
            />
          ) : null}
        </InfoCard>

        <InfoCard title="Water uptake" tone="water">
          <ProgressRow label="Very healthy" value={water?.very_healthy_pixel_percentage} />
          <ProgressRow label="Excellent" value={water?.excellent_pixel_percentage} />
          <ProgressRow label="Adequate" value={water?.adequat_pixel_percentage} />
          <ProgressRow label="Less" value={water?.less_pixel_percentage} />
          <ProgressRow label="Deficient" value={water?.deficient_pixel_percentage} />
        </InfoCard>

        <InfoCard title="Pest status" tone="pest">
          {pest?.healthy_pixel_count != null ? (
            <Kv label="Healthy pixels" value={String(pest.healthy_pixel_count)} />
          ) : null}
          <ProgressRow label="Chewing" value={pest?.chewing_affected_pixel_percentage} />
          <ProgressRow label="Fungi" value={pest?.fungi_affected_pixel_percentage} />
          <ProgressRow label="Sucking" value={pest?.sucking_affected_pixel_percentage} />
          <ProgressRow label="Wilt" value={pest?.wilt_affected_pixel_percentage} />
        </InfoCard>

        <InfoCard title="Fertilizer (per acre)" tone="fertilizer">
          <div className="npk-row">
            <div className="npk-pill">
              <span>N</span>
              <strong>{formatNum(npk?.fertilizer_require_perAcre?.N)}</strong>
            </div>
            <div className="npk-pill">
              <span>P</span>
              <strong>{formatNum(npk?.fertilizer_require_perAcre?.P)}</strong>
            </div>
            <div className="npk-pill">
              <span>K</span>
              <strong>{formatNum(npk?.fertilizer_require_perAcre?.K)}</strong>
            </div>
          </div>
          <Kv
            label="Soil pH"
            value={formatNum(npk?.soil_statistics?.phh2o ?? agro?.soil?.phh2o)}
          />
          <Kv
            label="Organic carbon"
            value={formatNum(npk?.soil_statistics?.soil_organic_carbon)}
          />
          <Kv label="Soil N" value={formatNum(npk?.soil_statistics?.total_nitrogen)} />
          <Kv label="Soil P" value={formatNum(npk?.soil_statistics?.phosphorus)} />
          <Kv label="Soil K" value={formatNum(npk?.soil_statistics?.potassium)} />
        </InfoCard>

        <InfoCard title="Weather now" tone="weather">
          <div className="weather-hero">
            <span className="weather-temp">
              {weather?.temperature_c != null ? `${weather.temperature_c}°` : '—'}
            </span>
            <span className="weather-place">{weather?.location || '—'}</span>
          </div>
          <Kv
            label="Humidity"
            value={weather?.humidity != null ? `${weather.humidity}%` : '—'}
          />
          <Kv
            label="Wind"
            value={weather?.wind_kph != null ? `${weather.wind_kph} km/h` : '—'}
          />
          <Kv
            label="Rain"
            value={weather?.precip_mm != null ? `${weather.precip_mm} mm` : '—'}
          />
          <Kv label="Updated" value={weather?.localtime || '—'} />
        </InfoCard>
      </div>

      {forecast.length > 0 && (
        <section className="forecast-section">
          <h3 className="section-title">5-day forecast</h3>
          <div className="forecast-grid">
            {forecast.map((d, i) => (
              <article key={d?.date ?? `forecast-${i}`} className="forecast-card">
                <p className="forecast-date">{d?.date || '—'}</p>
                <p className="forecast-max">{d?.temperature_max || '—'}</p>
                <p className="forecast-min">Min {d?.temperature_min || '—'}</p>
                <div className="forecast-meta">
                  <span>{d?.precipitation || '—'}</span>
                  <span>{d?.wind_speed_max || '—'}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function FarmerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const routeLocation = useLocation();
  const navSeed =
    (routeLocation.state as LocationState | null)?.farmer &&
    String((routeLocation.state as LocationState).farmer!.id) === String(id)
      ? (routeLocation.state as LocationState).farmer!
      : null;

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [dashboard, setDashboard] = useState<ManagerDashboardResponse | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  /** Bump to re-run load; softRefresh keeps UI, hardRefresh bypasses cache. */
  const [refreshTick, setRefreshTick] = useState(0);
  const softRefreshRef = useRef(false);
  const hardRefreshRef = useRef(false);
  /** Ignore late FastAPI responses from an older load. */
  const loadGenRef = useRef(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loadGen = ++loadGenRef.current;
    const softRefresh = softRefreshRef.current;
    const hardRefresh = hardRefreshRef.current;
    softRefreshRef.current = false;
    hardRefreshRef.current = false;

    const isCurrent = () => !cancelled && loadGenRef.current === loadGen;

    function applyReport(
      report: ManagerDashboardResponse,
      opts?: { persistMobile?: string },
    ): void {
      if (!isCurrent()) return;
      setDashboard(report);
      setSelectedPlot((prev) => {
        if (prev && report.plots?.some((p) => p.plot_name === prev)) return prev;
        return report.plots?.[0]?.plot_name ?? prev;
      });
      setReportError(null);
      if (opts?.persistMobile) {
        cacheSet(reportCacheKey(opts.persistMobile), report, CACHE_TTL.report);
      }
    }

    /** Paint previous report and keep it until a successful refetch replaces it. */
    function paintPreviousReport(
      report: ManagerDashboardResponse | null | undefined,
    ): boolean {
      if (!report || !isCurrent()) return false;
      setDashboard(report);
      setReportError(null);
      setSelectedPlot((prev) => {
        if (prev && report.plots?.some((p) => p.plot_name === prev)) return prev;
        return prev ?? report.plots?.[0]?.plot_name ?? null;
      });
      return true;
    }

    async function load() {
      setError(null);
      // Keep prior reportError only until we know whether we have previous data to show
      if (!softRefresh) setReportError(null);

      const fKey = farmerCacheKey(id!);
      if (hardRefresh) cacheRemove(fKey);

      const detailCachedRaw = hardRefresh ? null : cacheGet<Farmer>(fKey);
      const detailCached = detailCachedRaw ? safeFarmer(detailCachedRaw) : null;
      const listSeedRaw = hardRefresh ? null : navSeed ?? findCachedListFarmer(id!);
      const listSeed = listSeedRaw ? safeFarmer(listSeedRaw) : null;
      const paintSeed = detailCached ?? listSeed;

      // 1) Paint farmer immediately — never blank when we have cache/seed
      if (paintSeed) {
        setFarmer(paintSeed);
        setLoading(false);
        if (paintSeed.plots?.length) {
          const first = paintSeed.plots[0];
          setSelectedPlot((prev) => prev ?? (first.name || String(first.id)));
        }
      } else if (softRefresh) {
        // Soft refresh with no farmer cache: keep whatever is already on screen
        setLoading(false);
      } else {
        setLoading(true);
        // Only clear when navigating to a different farmer (not while refetching)
        setFarmer((prev) => (prev && String(prev.id) === String(id) ? prev : null));
        setDashboard((prev) =>
          prev && String(prev.farmer?.id) === String(id) ? prev : null,
        );
        setSelectedPlot(null);
      }

      // 2–3) Django farmer + FastAPI report (stale-while-revalidate for report).
      let farmerData = detailCached ?? paintSeed ?? null;
      const needFarmerFetch = softRefresh || hardRefresh || !detailCached;

      const seedMobile = normalizeMobile(paintSeed?.phone_number?.trim() || '');
      const seedHasMobile = seedMobile.length >= 10;
      const rKeyForSeed = seedHasMobile ? reportCacheKey(seedMobile) : '';

      // Hard refresh: drop disk cache but keep in-memory dashboard until new data arrives
      if (hardRefresh && rKeyForSeed) cacheRemove(rKeyForSeed);

      const reportEntry =
        hardRefresh || !rKeyForSeed
          ? null
          : cacheGetFreshOrStale<ManagerDashboardResponse>(rKeyForSeed);
      let cachedReport = reportEntry?.data ? safeReport(reportEntry.data) : null;
      const reportStale = Boolean(reportEntry?.stale);
      // Refetch when missing, stale, soft, or hard — but always paint previous first
      const needReportFetch =
        seedHasMobile &&
        (softRefresh || hardRefresh || !cachedReport || reportStale);

      // Always show previous report before any background FastAPI call
      if (cachedReport) {
        paintPreviousReport(cachedReport);
      }

      // Both caches fresh and known mobile — nothing to fetch
      if (seedHasMobile && !needFarmerFetch && !needReportFetch) {
        setReportLoading(false);
        setReportError(null);
        return;
      }

      // Parallel path: known mobile → farmer + report together
      if (seedHasMobile && (needFarmerFetch || needReportFetch)) {
        if (needReportFetch) setReportLoading(true);

        const farmerPromise: Promise<Farmer | null> = needFarmerFetch
          ? fetchFarmerDeduped(id!).catch((err) => {
              if (!paintSeed) throw err;
              return paintSeed;
            })
          : Promise.resolve(farmerData);

        const reportPromise: Promise<ManagerDashboardResponse | null> = needReportFetch
          ? fetchReportDeduped(seedMobile).catch(() => null)
          : Promise.resolve(cachedReport);

        try {
          const [farmerResult, reportResult] = await Promise.all([
            farmerPromise,
            reportPromise,
          ]);
          if (!isCurrent()) return;

          const farmerOk = farmerResult ? safeFarmer(farmerResult) : null;
          if (farmerOk) {
            farmerData = farmerOk;
            setFarmer(farmerOk);
            setLoading(false);
            if (needFarmerFetch && farmerOk !== paintSeed) {
              cacheSet(fKey, farmerOk, CACHE_TTL.farmer);
            }
          } else if (farmerResult && !farmerOk) {
            setLoading(false);
            setError('Farmer response was incomplete. Keeping previous data if available.');
            if (!paintSeed) {
              setReportLoading(false);
              return;
            }
          } else if (!paintSeed) {
            setLoading(false);
            setError('Failed to load farmer.');
            setFarmer(null);
            setReportLoading(false);
            return;
          }

          const reportOk = reportResult ? safeReport(reportResult) : null;
          if (reportOk) {
            applyReport(reportOk, { persistMobile: seedMobile });
          } else if (needReportFetch && reportResult && !reportOk) {
            // Keep previous dashboard — only warn if we had nothing to show
            if (!cachedReport) {
              setReportError(
                'Field report response was incomplete. Showing farmer profile only.',
              );
            }
          } else if (needReportFetch && !cachedReport) {
            setReportError('Could not load field report for this farmer.');
          }
          // If fetch failed but cachedReport was painted — leave it (no conflict)
        } catch (err) {
          if (!isCurrent()) return;
          setLoading(false);
          if (!paintSeed) {
            if (err instanceof ApiError) setError(err.message);
            else setError('Failed to load farmer.');
            setFarmer(null);
          }
        } finally {
          if (isCurrent()) setReportLoading(false);
        }

        if (farmerData?.plots?.length) {
          setSelectedPlot((prev) => {
            if (prev) return prev;
            const first = farmerData!.plots[0];
            return first.name || String(first.id);
          });
        }
        return;
      }

      // Sequential fallback: no seed mobile yet — fetch farmer first, then report
      if (needFarmerFetch) {
        try {
          const data = await fetchFarmerDeduped(id!);
          if (!isCurrent()) return;
          const farmerOk = safeFarmer(data);
          if (!farmerOk) {
            setLoading(false);
            setError('Farmer response was incomplete.');
            if (!paintSeed) return;
            farmerData = paintSeed;
          } else {
            farmerData = farmerOk;
            setFarmer(farmerOk);
            setLoading(false);
            cacheSet(fKey, farmerOk, CACHE_TTL.farmer);
          }
        } catch (err) {
          if (!isCurrent()) return;
          setLoading(false);
          if (!paintSeed) {
            if (err instanceof ApiError) setError(err.message);
            else setError('Failed to load farmer.');
            setFarmer(null);
            return;
          }
          farmerData = paintSeed;
        }
      }

      if (!farmerData || !isCurrent()) return;

      const mobileRaw = farmerData.phone_number?.trim() || '';
      const mobile = normalizeMobile(mobileRaw);
      if (!mobile || mobile.length < 10) {
        setReportError('This farmer has no mobile number, so field report cannot load.');
        setReportLoading(false);
        return;
      }

      if (farmerData.plots?.length) {
        setSelectedPlot((prev) => {
          if (prev) return prev;
          const first = farmerData!.plots[0];
          return first.name || String(first.id);
        });
      }

      const rKey = reportCacheKey(mobile);
      if (hardRefresh) cacheRemove(rKey);
      const seqEntry = hardRefresh
        ? null
        : cacheGetFreshOrStale<ManagerDashboardResponse>(rKey);
      cachedReport = seqEntry?.data ? safeReport(seqEntry.data) : null;
      const seqStale = Boolean(seqEntry?.stale);
      const needSeqReportFetch = softRefresh || hardRefresh || !cachedReport || seqStale;

      // Paint previous (fresh or stale) before FastAPI round-trip
      if (cachedReport) {
        paintPreviousReport(cachedReport);
      }

      if (cachedReport && !needSeqReportFetch) {
        setReportLoading(false);
        setReportError(null);
        return;
      }

      setReportLoading(true);
      try {
        const report = await fetchReportDeduped(mobile);
        if (!isCurrent()) return;
        const reportOk = safeReport(report);
        if (!reportOk) {
          if (!cachedReport) {
            setReportError(
              'Field report response was incomplete. Showing farmer profile only.',
            );
          }
          return;
        }
        applyReport(reportOk, { persistMobile: mobile });
      } catch (err) {
        if (!isCurrent()) return;
        // Keep previous report on screen; only surface error when nothing was shown
        if (!cachedReport) {
          if (err instanceof ApiError) setReportError(err.message);
          else setReportError('Could not load field report for this farmer.');
        }
      } finally {
        if (isCurrent()) setReportLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, refreshTick, navSeed]);

  const displayFarmer = dashboard?.farmer ?? farmer;
  const location = displayFarmer
    ? [displayFarmer.village, displayFarmer.taluka, displayFarmer.district, displayFarmer.state]
        .filter(Boolean)
        .join(', ')
    : '';

  const reportPlots = useMemo(
    () =>
      (dashboard?.plots ?? []).filter(
        (p): p is ManagerPlot => Boolean(p && typeof p.plot_name === 'string' && p.plot_name),
      ),
    [dashboard?.plots],
  );
  const hasReportPlots = reportPlots.length > 0;
  const djangoPlots = farmer?.plots ?? [];
  const activePlot = useMemo(
    () => reportPlots.find((p) => p.plot_name === selectedPlot) ?? reportPlots[0] ?? null,
    [reportPlots, selectedPlot],
  );
  const activeFarmerPlot = useMemo(
    () =>
      activePlot?.plot_name
        ? matchFarmerPlot(farmer?.plots, activePlot.plot_name)
        : null,
    [farmer?.plots, activePlot],
  );

  // Hooks must run unconditionally — never after early returns (blank-screen crash).
  const lastLogin = useMemo(
    () => formatLastLoginParts(farmer?.last_login),
    [farmer?.last_login],
  );

  const onRefreshClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    if (e.shiftKey) hardRefreshRef.current = true;
    else softRefreshRef.current = true;
    setRefreshTick((t) => t + 1);
  }, []);

  if (loading && !farmer) {
    return (
      <div className="page fade-in">
        <p className="muted">Loading farmer…</p>
      </div>
    );
  }

  // Only full-page error when there is nothing to show; otherwise keep shell + inline alert
  if (!farmer && !loading) {
    return (
      <div className="page fade-in">
        <Link to="/farmers" className="back-link">
          ← Back to farmers
        </Link>
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          {error || 'Farmer not found.'}
        </div>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="page fade-in">
        <p className="muted">Loading farmer…</p>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <div className="detail-topbar">
        <Link to="/farmers" className="back-link">
          ← Back to farmers
        </Link>
        <button
          type="button"
          className="btn btn-secondary btn-compact"
          disabled={loading && !farmer}
          title="Refresh (Shift+click to force bypass cache)"
          onClick={onRefreshClick}
        >
          {reportLoading || loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <header className="detail-banner">
        <div className="detail-banner-main farmer-title-row">
          <span className="farmer-avatar farmer-avatar-lg">{farmerInitials(displayFarmer)}</span>
          <div>
            <p className="dash-eyebrow">Farmer profile</p>
            <h1>{farmerDisplayName(displayFarmer)}</h1>
            <p className="detail-meta">
              <span className="mono">{displayFarmer?.phone_number || farmer.phone_number || '—'}</span>
              {location && <span>{location}</span>}
            </p>
          </div>
        </div>
        <div className="detail-stats">
          <div className="stat-tile">
            <span className="stat-value">{dashboard?.plots_count ?? farmer.plot_count ?? 0}</span>
            <span className="stat-label">Plots</span>
          </div>
          <div className="stat-tile stat-tile-login">
            {lastLogin.never ? (
              <span className="stat-value stat-value-sm">Never</span>
            ) : (
              <>
                <span className="stat-value stat-value-sm">{lastLogin.date}</span>
                <span className="stat-login-time">{lastLogin.time}</span>
              </>
            )}
            <span className="stat-label">Last login</span>
          </div>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {reportLoading && (
        <div className={`loading-card ${hasReportPlots || djangoPlots.length ? 'loading-card-inline' : ''}`}>
          <p>{hasReportPlots ? 'Updating field report in background…' : 'Loading field report…'}</p>
          <span>
            {hasReportPlots
              ? 'Previous report stays visible until the new FastAPI data is ready'
              : djangoPlots.length
                ? 'Showing registered plots now — growth, moisture, water, pest & tiles load next'
                : 'Profile is ready — fetching growth, moisture, water, pest & tiles'}
          </span>
        </div>
      )}
      {reportError && !reportLoading && <div className="alert alert-error">{reportError}</div>}

      {hasReportPlots ? (
        <>
          <div className="plot-tabs" role="tablist" aria-label="Plots">
            {reportPlots.map((p) => {
              const score = p.field_score?.field_score;
              const active = (activePlot?.plot_name ?? '') === p.plot_name;
              const cropLabel = [p.crop_details?.crop_type, p.crop_details?.crop_variety]
                .filter(Boolean)
                .join(' · ');
              return (
                <button
                  key={p.plot_name}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`plot-tab-card ${active ? 'active' : ''} ${reportLoading ? 'plot-tab-loading' : ''}`}
                  onClick={() => setSelectedPlot(p.plot_name)}
                >
                  <span className="plot-tab-name">Plot {p.plot_name}</span>
                  <span className="plot-tab-crop">{cropLabel || 'Field report'}</span>
                  <span className={`plot-tab-score ${scoreClass(score)}`}>
                    {reportLoading && score == null ? (
                      <LoadingSpinner label="Refreshing field report" />
                    ) : score != null ? (
                      formatNum(score, 0)
                    ) : (
                      '—'
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {activePlot && <PlotReport plot={activePlot} farmerPlot={activeFarmerPlot} />}
        </>
      ) : djangoPlots.length > 0 ? (
        <DjangoPlotsPanel
          farmer={farmer}
          selectedName={selectedPlot}
          onSelect={setSelectedPlot}
          reportLoading={reportLoading}
        />
      ) : !reportLoading ? (
        <p className="muted">
          {dashboard
            ? 'No plot reports found for this mobile number.'
            : 'No plots registered for this farmer yet.'}
        </p>
      ) : null}
    </div>
  );
}

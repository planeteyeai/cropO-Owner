import type { LayerTileBlock, ManagerPlot } from '../types/managerDashboard';
import type { GeoPolygon, Plot as FarmerPlot } from '../types/owner';

export type PlotLayerKey = 'growth' | 'soil' | 'water' | 'pest';

export type LatLngBoundsTuple = [[number, number], [number, number]];

export interface PlotLayerOption {
  key: PlotLayerKey;
  label: string;
  /** Exact tile template from API response (normalized placeholders only). */
  tileUrl: string;
  imageDate?: string | null;
  imageCount?: number | null;
}

/** Fix placeholder casing / truncated {y} only — never invent a host or map id. */
export function normalizeTileUrl(url: string): string | null {
  let next = url.trim();
  if (!next) return null;
  if (!/^https?:\/\//i.test(next)) return null;

  next = next
    .replace(/\{Z\}/g, '{z}')
    .replace(/\{X\}/g, '{x}')
    .replace(/\{Y\}/g, '{y}');

  // API sometimes returns .../tiles/{z}/{x}/ without {y}
  if (/\{z\}\/\{x\}\/?$/i.test(next) && !/\{y\}/i.test(next)) {
    next = `${next.replace(/\/?$/, '/') }{y}`;
  }

  // Must be a Leaflet XYZ template from the endpoint
  if (!/\{z\}/i.test(next) || !/\{x\}/i.test(next) || !/\{y\}/i.test(next)) {
    return null;
  }

  return next;
}

function readTileUrlField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return normalizeTileUrl(value);
}

/** Only read explicit tile_url fields from the layer response block. */
export function extractTileUrl(block?: LayerTileBlock | null): string | null {
  if (!block) return null;

  const direct = readTileUrlField(block.tile_url);
  if (direct) return direct;

  const fromFeature = readTileUrlField(block.features?.[0]?.properties?.tile_url);
  if (fromFeature) return fromFeature;

  return null;
}

export function extractImageDate(block?: LayerTileBlock | null): string | null {
  if (!block) return null;
  const fromBlock = block.latest_image_date?.trim();
  if (fromBlock) return fromBlock;
  const fromFeature = block.features?.[0]?.properties?.latest_image_date;
  if (typeof fromFeature === 'string' && fromFeature.trim()) return fromFeature.trim();
  const fromList = block.image_dates?.[0];
  if (typeof fromList === 'string' && fromList.trim()) return fromList.trim();
  return null;
}

export function extractImageCount(block?: LayerTileBlock | null): number | null {
  if (!block) return null;
  if (typeof block.image_count === 'number' && Number.isFinite(block.image_count)) {
    return block.image_count;
  }
  const fromFeature = block.features?.[0]?.properties?.image_count;
  if (typeof fromFeature === 'number' && Number.isFinite(fromFeature)) return fromFeature;
  return null;
}

function pushCoords(coords: unknown, out: number[][]): void {
  if (!Array.isArray(coords)) return;
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    out.push([Number(coords[0]), Number(coords[1])]);
    return;
  }
  for (const item of coords) pushCoords(item, out);
}

function boundsFromPoints(pts: number[][]): LatLngBoundsTuple | null {
  if (pts.length === 0) return null;
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lons);
  const east = Math.max(...lons);
  if (![south, north, west, east].every((n) => Number.isFinite(n))) return null;
  if (east === west || north === south) return null;
  if (east - west > 5 || north - south > 5) return null;
  return [
    [south, west],
    [north, east],
  ];
}

export function boundsFromPolygon(boundary?: GeoPolygon | null): LatLngBoundsTuple | null {
  if (!boundary?.coordinates) return null;
  const pts: number[][] = [];
  pushCoords(boundary.coordinates, pts);
  return boundsFromPoints(pts);
}

export function matchFarmerPlot(
  farmerPlots: FarmerPlot[] | undefined,
  plotName: string,
): FarmerPlot | null {
  if (!farmerPlots?.length || !plotName) return null;
  const key = plotName.trim().toLowerCase();
  return (
    farmerPlots.find(
      (p) =>
        p.field_id?.toLowerCase() === key ||
        p.name?.toLowerCase() === key ||
        String(p.id) === plotName.trim(),
    ) ?? null
  );
}

/**
 * AOI only from endpoint data (Django farmer boundary/location or FastAPI geometry/bbox/center).
 * No hardcoded default location.
 */
export function boundsFromPlot(
  plot: ManagerPlot,
  farmerPlot?: FarmerPlot | null,
): LatLngBoundsTuple | null {
  const fromFarmer = boundsFromPolygon(farmerPlot?.boundary ?? null);
  if (fromFarmer) return fromFarmer;

  if (farmerPlot?.location?.coordinates?.length === 2) {
    const [lon, lat] = farmerPlot.location.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const pad = 0.008;
      return [
        [lat - pad, lon - pad],
        [lat + pad, lon + pad],
      ];
    }
  }

  const bboxCandidates = [
    plot.bbox,
    plot.bounds,
    plot.daily_report?.growth?.bbox,
    plot.daily_report?.soil_moisture?.bbox,
    plot.daily_report?.water_uptake?.bbox,
    plot.daily_report?.pest_detection?.bbox,
    plot.daily_report?.growth?.features?.[0]?.bbox,
    plot.daily_report?.soil_moisture?.features?.[0]?.bbox,
    plot.daily_report?.water_uptake?.features?.[0]?.bbox,
    plot.daily_report?.pest_detection?.features?.[0]?.bbox,
  ];

  for (const bbox of bboxCandidates) {
    if (!Array.isArray(bbox) || bbox.length < 4) continue;
    const [a, b, c, d] = bbox.map(Number);
    if (![a, b, c, d].every((n) => Number.isFinite(n))) continue;

    const geoJsonOrder = Math.abs(a) >= Math.abs(b);
    const west = geoJsonOrder ? a : b;
    const south = geoJsonOrder ? b : a;
    const east = geoJsonOrder ? c : d;
    const north = geoJsonOrder ? d : c;
    const box = boundsFromPoints([
      [west, south],
      [east, north],
    ]);
    if (box) return box;
  }

  const geometryCandidates = [
    plot.geometry,
    plot.daily_report?.growth?.features?.[0]?.geometry,
    plot.daily_report?.soil_moisture?.features?.[0]?.geometry,
    plot.daily_report?.water_uptake?.features?.[0]?.geometry,
    plot.daily_report?.pest_detection?.features?.[0]?.geometry,
  ];

  for (const geometry of geometryCandidates) {
    if (!geometry || typeof geometry !== 'object') continue;
    const coords = 'coordinates' in geometry ? geometry.coordinates : null;
    if (!coords) continue;
    const pts: number[][] = [];
    pushCoords(coords, pts);
    const box = boundsFromPoints(pts);
    if (box) return box;
  }

  const center =
    plot.center ||
    plot.daily_report?.growth?.center ||
    plot.daily_report?.soil_moisture?.center ||
    plot.daily_report?.water_uptake?.center ||
    plot.daily_report?.pest_detection?.center ||
    null;
  if (center?.lat != null) {
    const lon = center.lon ?? center.lng;
    if (lon != null && Number.isFinite(center.lat) && Number.isFinite(Number(lon))) {
      const pad = 0.008;
      return [
        [center.lat - pad, Number(lon) - pad],
        [center.lat + pad, Number(lon) + pad],
      ];
    }
  }

  return null;
}

export function layersFromPlot(plot: ManagerPlot): PlotLayerOption[] {
  const report = plot.daily_report;
  const defs: Array<{ key: PlotLayerKey; label: string; block?: LayerTileBlock | null }> = [
    { key: 'growth', label: 'GROWTH', block: report?.growth },
    { key: 'soil', label: 'SOIL', block: report?.soil_moisture },
    { key: 'water', label: 'WATER', block: report?.water_uptake },
    { key: 'pest', label: 'PESTS', block: report?.pest_detection },
  ];

  const out: PlotLayerOption[] = [];
  for (const d of defs) {
    const tileUrl = extractTileUrl(d.block);
    if (!tileUrl) continue;
    out.push({
      key: d.key,
      label: d.label,
      tileUrl,
      imageDate: extractImageDate(d.block),
      imageCount: extractImageCount(d.block),
    });
  }
  return out;
}

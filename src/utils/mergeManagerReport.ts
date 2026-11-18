import type {
  DailyReport,
  LayerTileBlock,
  ManagerDashboardResponse,
  ManagerPlot,
} from '../types/managerDashboard';

/** True when value looks like real API data (not empty/null). */
export function hasApiValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(hasApiValue);
  }
  return false;
}

function preferIncoming<T>(incoming: T | null | undefined, previous: T | null | undefined): T | null | undefined {
  return hasApiValue(incoming) ? incoming : previous;
}

function mergeLayer(
  incoming: LayerTileBlock | null | undefined,
  previous: LayerTileBlock | null | undefined,
): LayerTileBlock | null | undefined {
  if (!hasApiValue(incoming) && !hasApiValue(previous)) return incoming ?? previous ?? null;
  if (!hasApiValue(incoming)) return previous;
  if (!hasApiValue(previous)) return incoming;
  return {
    ...previous,
    ...incoming,
    pixel_summary: preferIncoming(incoming?.pixel_summary, previous?.pixel_summary) as
      | LayerTileBlock['pixel_summary']
      | undefined,
    features: preferIncoming(incoming?.features, previous?.features) as LayerTileBlock['features'],
    tile_url: preferIncoming(incoming?.tile_url, previous?.tile_url) as string | null | undefined,
    latest_image_date: preferIncoming(
      incoming?.latest_image_date,
      previous?.latest_image_date,
    ) as string | null | undefined,
  };
}

function mergeDailyReport(
  incoming: DailyReport | null | undefined,
  previous: DailyReport | null | undefined,
): DailyReport | null | undefined {
  if (!hasApiValue(incoming) && !hasApiValue(previous)) return incoming ?? previous ?? null;
  if (!hasApiValue(incoming)) return previous;
  if (!hasApiValue(previous)) return incoming;

  return {
    ...previous,
    ...incoming,
    agro_stats: preferIncoming(incoming?.agro_stats, previous?.agro_stats) as DailyReport['agro_stats'],
    growth: mergeLayer(incoming?.growth, previous?.growth) as DailyReport['growth'],
    soil_moisture: mergeLayer(
      incoming?.soil_moisture,
      previous?.soil_moisture,
    ) as DailyReport['soil_moisture'],
    water_uptake: mergeLayer(
      incoming?.water_uptake,
      previous?.water_uptake,
    ) as DailyReport['water_uptake'],
    pest_detection: mergeLayer(
      incoming?.pest_detection,
      previous?.pest_detection,
    ) as DailyReport['pest_detection'],
    npk_analysis: preferIncoming(
      incoming?.npk_analysis,
      previous?.npk_analysis,
    ) as DailyReport['npk_analysis'],
    current_weather: preferIncoming(
      incoming?.current_weather,
      previous?.current_weather,
    ) as DailyReport['current_weather'],
    forecast: preferIncoming(incoming?.forecast, previous?.forecast) as DailyReport['forecast'],
  };
}

/** Merge one plot: keep previous section values until new section has real API data. */
export function mergeManagerPlot(
  incoming: ManagerPlot,
  previous: ManagerPlot | null | undefined,
): ManagerPlot {
  if (!previous || previous.plot_name !== incoming.plot_name) return incoming;

  return {
    ...previous,
    ...incoming,
    plot_name: incoming.plot_name || previous.plot_name,
    crop_details: preferIncoming(
      incoming.crop_details,
      previous.crop_details,
    ) as ManagerPlot['crop_details'],
    field_score: preferIncoming(
      incoming.field_score,
      previous.field_score,
    ) as ManagerPlot['field_score'],
    irrigation_and_soil_moisture: preferIncoming(
      incoming.irrigation_and_soil_moisture,
      previous.irrigation_and_soil_moisture,
    ) as ManagerPlot['irrigation_and_soil_moisture'],
    geometry: preferIncoming(incoming.geometry, previous.geometry) as ManagerPlot['geometry'],
    bbox: preferIncoming(incoming.bbox, previous.bbox) as ManagerPlot['bbox'],
    bounds: preferIncoming(incoming.bounds, previous.bounds) as ManagerPlot['bounds'],
    center: preferIncoming(incoming.center, previous.center) as ManagerPlot['center'],
    daily_report: mergeDailyReport(incoming.daily_report, previous.daily_report),
  };
}

/**
 * Merge new FastAPI dashboard into previous.
 * - Plots matched by plot_name
 * - Incomplete new sections do not wipe previous
 * - Previous plots kept if missing from incomplete incoming (unless replaceAll)
 */
export function mergeManagerDashboard(
  previous: ManagerDashboardResponse | null | undefined,
  incoming: ManagerDashboardResponse,
  opts?: { replaceMissingPlots?: boolean },
): ManagerDashboardResponse {
  if (!previous) return incoming;

  const prevByName = new Map(
    (previous.plots ?? [])
      .filter((p) => p?.plot_name)
      .map((p) => [p.plot_name, p] as const),
  );

  const mergedPlots: ManagerPlot[] = [];
  const seen = new Set<string>();

  for (const plot of incoming.plots ?? []) {
    if (!plot?.plot_name) continue;
    seen.add(plot.plot_name);
    mergedPlots.push(mergeManagerPlot(plot, prevByName.get(plot.plot_name)));
  }

  if (!opts?.replaceMissingPlots) {
    for (const prev of previous.plots ?? []) {
      if (prev?.plot_name && !seen.has(prev.plot_name)) {
        mergedPlots.push(prev);
      }
    }
  }

  return {
    ...previous,
    ...incoming,
    mobile_number: incoming.mobile_number || previous.mobile_number,
    report_date: incoming.report_date || previous.report_date,
    generated_at: incoming.generated_at || previous.generated_at,
    farmer: hasApiValue(incoming.farmer) ? { ...previous.farmer, ...incoming.farmer } : previous.farmer,
    plots_count: incoming.plots_count || mergedPlots.length || previous.plots_count,
    plots: mergedPlots,
  };
}

/** Section has at least one numeric/string API field worth showing. */
export function sectionHasData(...values: unknown[]): boolean {
  return values.some(hasApiValue);
}

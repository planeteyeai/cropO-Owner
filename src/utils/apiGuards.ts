import type { ManagerDashboardResponse, ManagerPlot } from '../types/managerDashboard';
import type { Farmer } from '../types/owner';
import type { ShipmentListItem } from '../types/shipment';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accept a farmer-like payload; normalize arrays so render never crashes. */
export function asFarmer(value: unknown): Farmer | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'number' && typeof value.id !== 'string') return null;

  const id = Number(value.id);
  if (!Number.isFinite(id)) return null;

  return {
    id,
    username: String(value.username ?? ''),
    first_name: String(value.first_name ?? ''),
    last_name: String(value.last_name ?? ''),
    full_name: String(value.full_name ?? ''),
    phone_number: String(value.phone_number ?? ''),
    village: (value.village as string | null) ?? null,
    taluka: (value.taluka as string | null) ?? null,
    district: (value.district as string | null) ?? null,
    state: (value.state as string | null) ?? null,
    last_login: (value.last_login as string | null | undefined) ?? null,
    plot_count: Number(value.plot_count ?? 0) || 0,
    plots: Array.isArray(value.plots) ? (value.plots as Farmer['plots']) : [],
    crops: Array.isArray(value.crops) ? (value.crops as Farmer['crops']) : [],
  };
}

function asManagerPlot(value: unknown): ManagerPlot | null {
  if (!isRecord(value)) return null;
  const plotName = value.plot_name;
  if (typeof plotName !== 'string' || !plotName.trim()) return null;
  return {
    ...(value as unknown as ManagerPlot),
    plot_name: plotName,
  };
}

/** Accept manager-dashboard payload; drop invalid plots instead of crashing. */
export function asManagerDashboard(value: unknown): ManagerDashboardResponse | null {
  if (!isRecord(value)) return null;

  const rawPlots = Array.isArray(value.plots) ? value.plots : [];
  const plots = rawPlots
    .map(asManagerPlot)
    .filter((p): p is ManagerPlot => p != null);

  const farmerRaw = value.farmer;
  const farmer = isRecord(farmerRaw)
    ? ({
        id: Number(farmerRaw.id) || 0,
        username: String(farmerRaw.username ?? ''),
        first_name: String(farmerRaw.first_name ?? ''),
        last_name: String(farmerRaw.last_name ?? ''),
        full_name: String(farmerRaw.full_name ?? ''),
        phone_number: String(farmerRaw.phone_number ?? ''),
        village: (farmerRaw.village as string | null) ?? null,
        taluka: (farmerRaw.taluka as string | null) ?? null,
        district: (farmerRaw.district as string | null) ?? null,
        state: (farmerRaw.state as string | null) ?? null,
      } satisfies ManagerDashboardResponse['farmer'])
    : {
        id: 0,
        username: '',
        first_name: '',
        last_name: '',
        full_name: '',
        phone_number: String(value.mobile_number ?? ''),
        village: null,
        taluka: null,
        district: null,
        state: null,
      };

  return {
    mobile_number: String(value.mobile_number ?? farmer.phone_number ?? ''),
    report_date: String(value.report_date ?? ''),
    generated_at: String(value.generated_at ?? ''),
    farmer,
    plots_count: Number(value.plots_count ?? plots.length) || plots.length,
    plots,
  };
}

export function asFarmerListPayload(value: unknown): {
  data: Farmer[];
  count: number;
  next: string | null;
  previous: string | null;
} | null {
  if (!isRecord(value)) return null;
  const rows = Array.isArray(value.data) ? value.data : [];
  const data = rows.map(asFarmer).filter((f): f is Farmer => f != null);
  return {
    data,
    count: Number(value.count ?? data.length) || data.length,
    next: (value.next as string | null) ?? null,
    previous: (value.previous as string | null) ?? null,
  };
}

export function asShipment(value: unknown): ShipmentListItem | null {
  if (!isRecord(value)) return null;
  if (value.record_type !== 'transport' && value.record_type !== 'warehouse') return null;
  const id = Number(value.id);
  if (!Number.isFinite(id)) return null;
  return value as unknown as ShipmentListItem;
}

export function asShipmentListPayload(value: unknown): {
  data: ShipmentListItem[];
  count: number;
  next: string | null;
  previous: string | null;
} | null {
  if (!isRecord(value)) return null;
  const rows = Array.isArray(value.data) ? value.data : [];
  const data = rows.map(asShipment).filter((s): s is ShipmentListItem => s != null);
  return {
    data,
    count: Number(value.count ?? data.length) || data.length,
    next: (value.next as string | null) ?? null,
    previous: (value.previous as string | null) ?? null,
  };
}

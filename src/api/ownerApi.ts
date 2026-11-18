import type {
  ApiErrorResponse,
  Farmer,
  FarmerListResponse,
  LoginSuccessResponse,
  OwnerUser,
} from '../types/owner';
import type { ShipmentListItem, ShipmentListResponse, ShipmentRecordType } from '../types/shipment';

/** Local Docker Django — always http on 8001 (never https://127.0.0.1, never :8000). */
const LOCAL_API_BASE = 'http://127.0.0.1:8001';

function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '';
  let base = raw.replace(/\/$/, '') || LOCAL_API_BASE;

  // Guard against misconfigured local HTTPS / wrong port that cause "Failed to fetch"
  try {
    const u = new URL(base);
    const host = u.hostname;
    if (host === '127.0.0.1' || host === 'localhost') {
      u.protocol = 'http:';
      if (u.port === '8000' || u.port === '') u.port = '8001';
      base = u.origin;
    }
  } catch {
    base = LOCAL_API_BASE;
  }

  return base;
}

const API_BASE = resolveApiBase();
const FARMERS_BASE = `${API_BASE}/api/farmers`;
const IS_NGROK = /ngrok/i.test(API_BASE);

const ACCESS_KEY = 'owner_access_token';
const REFRESH_KEY = 'owner_refresh_token';
const USER_KEY = 'owner_user';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getStoredUser(): OwnerUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OwnerUser;
  } catch {
    return null;
  }
}

export function saveSession(access: string, refresh: string, user: OwnerUser): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function messageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const b = body as ApiErrorResponse & { detail?: string };
  return b.message || b.error || b.detail || fallback;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  // Free ngrok shows an interstitial unless this header is present.
  if (IS_NGROK) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = `${FARMERS_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/failed to fetch|networkerror|load failed|abort/i.test(msg)) {
      throw new ApiError(
        `Cannot reach ${API_BASE} — check Docker`,
        0,
      );
    }
    throw new ApiError(msg || `Cannot reach ${API_BASE} — check Docker`, 0);
  }

  const body = await parseJson(res);

  if (res.status === 401 || res.status === 403) {
    clearSession();
    onUnauthorized?.();
    throw new ApiError(messageFromBody(body, 'Unauthorized'), res.status);
  }

  if (!res.ok) {
    throw new ApiError(messageFromBody(body, `Request failed (${res.status})`), res.status);
  }

  return body as T;
}

export async function ownerLogin(
  phone_number: string,
  password: string,
): Promise<LoginSuccessResponse> {
  return request<LoginSuccessResponse>(
    '/owner/login/',
    {
      method: 'POST',
      body: JSON.stringify({ phone_number, password }),
    },
    false,
  );
}

export interface ListFarmersParams {
  search?: string;
  page?: number;
  page_size?: number;
}

export async function listFarmers(params: ListFarmersParams = {}): Promise<FarmerListResponse> {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set('search', params.search.trim());
  qs.set('page', String(params.page ?? 1));
  qs.set('page_size', String(params.page_size ?? 20));
  return request<FarmerListResponse>(`/owner/farmers/?${qs.toString()}`);
}

export async function getFarmer(farmerId: number | string): Promise<Farmer> {
  return request<Farmer>(`/owner/farmers/${farmerId}/`);
}

export interface ListShipmentsParams {
  search?: string;
  type?: 'all' | ShipmentRecordType;
  status?: string;
  page?: number;
  page_size?: number;
}

export async function listShipments(
  params: ListShipmentsParams = {},
): Promise<ShipmentListResponse> {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set('search', params.search.trim());
  qs.set('type', params.type ?? 'all');
  if (params.status?.trim()) qs.set('status', params.status.trim());
  qs.set('page', String(params.page ?? 1));
  qs.set('page_size', String(params.page_size ?? 20));
  return request<ShipmentListResponse>(`/owner/shipments/?${qs.toString()}`);
}

export async function getShipment(
  recordType: ShipmentRecordType,
  recordId: number | string,
): Promise<ShipmentListItem> {
  return request<ShipmentListItem>(`/owner/shipments/${recordType}/${recordId}/`);
}

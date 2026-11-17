import type { ManagerDashboardResponse } from '../types/managerDashboard';
import { ApiError } from './ownerApi';

const FASTAPI_BASE =
  (import.meta.env.VITE_FASTAPI_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://cropoappapis.up.railway.app';

const FASTAPI_TOKEN = (import.meta.env.VITE_FASTAPI_BEARER_TOKEN as string | undefined)?.trim() || '';

const IS_NGROK = /ngrok/i.test(FASTAPI_BASE);

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Normalize to last 10 digits when possible (India mobile). */
export function normalizeMobile(phone: string): string {
  const digits = digitsOnly(phone);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
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
  const b = body as {
    message?: string;
    error?: string;
    detail?: string | Array<{ msg?: string }>;
  };
  if (typeof b.message === 'string') return b.message;
  if (typeof b.error === 'string') return b.error;
  if (typeof b.detail === 'string') return b.detail;
  if (Array.isArray(b.detail) && b.detail[0]?.msg) return String(b.detail[0].msg);
  return fallback;
}

/**
 * Read-only FastAPI manager dashboard.
 * GET /manager-dashboard?mobile_number=...&date=YYYY-MM-DD
 */
export async function getManagerDashboard(
  mobileNumber: string,
  date?: string,
): Promise<ManagerDashboardResponse> {
  const mobile = normalizeMobile(mobileNumber);
  if (!mobile || mobile.length < 10) {
    throw new ApiError('Farmer mobile number is missing or invalid.', 400);
  }

  const qs = new URLSearchParams({ mobile_number: mobile });
  if (date) qs.set('date', date);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (IS_NGROK) headers['ngrok-skip-browser-warning'] = 'true';
  if (FASTAPI_TOKEN) headers.Authorization = `Bearer ${FASTAPI_TOKEN}`;

  const res = await fetch(`${FASTAPI_BASE}/manager-dashboard?${qs.toString()}`, {
    method: 'GET',
    headers,
  });

  const body = await parseJson(res);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ApiError(
        messageFromBody(
          body,
          'Field report API requires authentication. Set VITE_FASTAPI_BEARER_TOKEN in .env.',
        ),
        res.status,
      );
    }
    throw new ApiError(messageFromBody(body, `Report request failed (${res.status})`), res.status);
  }

  return body as ManagerDashboardResponse;
}

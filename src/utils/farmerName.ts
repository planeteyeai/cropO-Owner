import type { Farmer } from '../types/owner';
import type { ManagerFarmer } from '../types/managerDashboard';

type NameLike = Pick<Farmer, 'full_name' | 'first_name' | 'last_name' | 'username'> | ManagerFarmer;

function titleCaseWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Prefer real person name; never show raw username-looking values as primary if names exist. */
export function farmerDisplayName(f: NameLike | null | undefined): string {
  if (!f) return 'Unknown farmer';

  const full = f.full_name?.trim();
  if (full && !/^[a-z0-9._-]+$/i.test(full.replace(/\s+/g, ''))) {
    return full.split(/\s+/).map(titleCaseWord).join(' ');
  }
  if (full && full.includes(' ')) {
    return full.split(/\s+/).map(titleCaseWord).join(' ');
  }

  const first = f.first_name?.trim() ?? '';
  const last = f.last_name?.trim() ?? '';
  const combined = `${first} ${last}`.trim();
  if (combined) return combined.split(/\s+/).map(titleCaseWord).join(' ');

  if (full) return titleCaseWord(full);
  return f.username?.trim() || 'Unknown farmer';
}

export function farmerInitials(f: NameLike | null | undefined): string {
  const name = farmerDisplayName(f);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

export function formatNum(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(digits);
}

export function formatPct(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

/** Format Django last_login ISO string for owner UI; null/invalid → Never. */
export function formatLastLogin(value: string | null | undefined): string {
  const parts = formatLastLoginParts(value);
  if (parts.never) return 'Never';
  return `${parts.date}, ${parts.time}`;
}

/** Split last_login into date + time for a single stat card. */
export function formatLastLoginParts(value: string | null | undefined): {
  date: string;
  time: string;
  never: boolean;
} {
  if (!value) return { date: 'Never', time: '', never: true };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: 'Never', time: '', never: true };
  return {
    date: d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    never: false,
  };
}

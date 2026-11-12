import type { TFunction } from 'i18next';
import type { AuthFileItem } from '@/types';
import type { QuotaCardState } from './providers';
import { isRecord } from '@/utils/helpers';
import { resolveAuthProvider } from '@/utils/quota/validators';

export interface BackendQuotaWindow {
  id: string;
  label: string;
  usedPercent: number;
  periodHours: number;
  resetAtMs: number | null;
  observedAtMs: number | null;
}

export interface BackendQuota {
  windows: BackendQuotaWindow[];
  state: string;
  validUntilMs: number | null;
}

const instant = (value: unknown): number | null => {
  if (typeof value !== 'string' || value.startsWith('0001-')) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

export function readBackendQuota(file: AuthFileItem, t: TFunction): BackendQuota | undefined {
  const provider = resolveAuthProvider(file);
  const snapshot = provider === 'codex' ? file.codex_quota : file.provider_quota;
  if (!isRecord(snapshot) || !Array.isArray(snapshot.windows)) return undefined;
  const observed = instant(snapshot.request_started_at) ?? instant(snapshot.observed_at);
  const windows: BackendQuotaWindow[] = [];
  const seen = new Set<string>();
  for (const raw of snapshot.windows.slice(0, 128)) {
    if (!isRecord(raw) || typeof raw.name !== 'string' || seen.has(raw.name)) continue;
    if (
      typeof raw.used_percent !== 'number' ||
      !Number.isFinite(raw.used_percent) ||
      raw.used_percent < 0
    )
      continue;
    if (
      typeof raw.window_seconds !== 'number' ||
      !Number.isFinite(raw.window_seconds) ||
      raw.window_seconds <= 0
    )
      continue;
    seen.add(raw.name);
    const hours = raw.window_seconds / 3600;
    const period =
      hours === 5
        ? t('quota_management.window_5h')
        : hours === 168
          ? t('quota_management.window_weekly')
          : hours >= 672 && hours <= 744
            ? t('quota_management.window_monthly')
            : t('quota_management.window_hours', { hours });
    let scope = raw.name.replace(/^(claude|codex|kimi|xai|antigravity):/, '');
    if (
      [
        'primary',
        'secondary',
        'five_hour',
        'seven_day',
        'weekly',
        'weekly-summary',
        'monthly',
        'monthly-credit',
      ].includes(scope)
    )
      scope = '';
    if (provider === 'claude' && scope.startsWith('seven_day_')) {
      scope = t(`claude_quota.${scope}`, { defaultValue: scope.slice(10) });
    } else {
      scope = scope.replace(/^scoped:/, '').replace(/^product:\d+:/, '');
    }
    windows.push({
      id: raw.name,
      label: scope ? `${period} · ${scope}` : period,
      usedPercent: raw.used_percent,
      periodHours: hours,
      resetAtMs: instant(raw.reset_at),
      observedAtMs: instant(raw.observed_at) ?? observed,
    });
  }
  if (!windows.length) return undefined;
  const guard = isRecord(file.quota_guard) ? file.quota_guard : {};
  return { windows, state: String(guard.state ?? ''), validUntilMs: instant(guard.valid_until) };
}

// Derived display state never mutates the separate manual-provider response cache.
export function withBackendQuota(
  file: AuthFileItem,
  manual: QuotaCardState | undefined,
  t: TFunction
): QuotaCardState | undefined {
  const backendQuota = readBackendQuota(file, t);
  if (!backendQuota) return manual;
  return {
    ...manual,
    status: manual?.status === 'loading' || manual?.status === 'error' ? manual.status : 'success',
    backendQuota,
    hasManualQuota: manual?.status === 'success',
  };
}

export function backendQuotaState(quota: BackendQuota, now: number): string {
  if (['query_failed', 'threshold', 'checking', 'stale', 'disabled'].includes(quota.state))
    return quota.state;
  if (quota.validUntilMs !== null && now >= quota.validUntilMs) return 'stale';
  return quota.state === 'ready' ? 'ready' : 'unknown';
}

import type { AuthFileItem, CodexQuotaState } from '@/types';
import type {
  UsageAccountRangeSummary,
  UsageAccountSummary,
  UsageStorageStatus,
} from '@/types/usage';
import { normalizeAuthIndex } from '@/utils/authIndex';

const DEFAULT_WEEKLY_WINDOW_HOURS = 7 * 24;
const MINIMUM_ESTIMATE_USED_PERCENT = 3;

export type WeeklyEstimateConfidence = 'low' | 'medium' | 'high';
export type WeeklyEstimateStatus =
  'loading' | 'sampling' | 'insufficient' | 'unavailable' | 'ready';

export interface WeeklyUsageBasis {
  key: string;
  authIndex: string;
  fromMs: number;
  resetAtMs: number;
  usedPercent: number;
}

export interface WeeklyUsageEstimate {
  status: WeeklyEstimateStatus;
  usedPercent: number;
  totalUsd?: number;
  windowCostUsd?: number;
  confidence?: WeeklyEstimateConfidence;
  coverageComplete?: boolean;
  estimated?: boolean;
  cacheWriteUnreported?: boolean;
}

export interface QuotaUsageCost {
  totalUsd: number;
  totalRequests: number;
  estimated: boolean;
  cacheWriteUnreported: boolean;
  weekly?: WeeklyUsageEstimate;
}

export const buildAccountUsageByAuthIndex = (
  accounts: UsageAccountSummary[]
): Map<string, UsageAccountSummary> => {
  const result = new Map<string, UsageAccountSummary>();
  accounts.forEach((account) => {
    const authIndex = normalizeAuthIndex(account.auth_index);
    if (authIndex) result.set(authIndex, account);
  });
  return result;
};

export const buildAccountRangeUsageByKey = (
  ranges: UsageAccountRangeSummary[]
): Map<string, UsageAccountRangeSummary> =>
  new Map(ranges.filter((range) => range.key).map((range) => [range.key, range]));

export const resolveCodexWeeklyUsageBasis = (
  file: AuthFileItem,
  quota: CodexQuotaState | undefined,
  nowMs = Date.now()
): WeeklyUsageBasis | undefined => {
  if (!quota || quota.status !== 'success') return undefined;
  const authIndex = normalizeAuthIndex(file['auth_index'] ?? file.authIndex);
  if (!authIndex) return undefined;

  const weekly = quota.windows.find((window) => window.id === 'weekly');
  if (!weekly) return undefined;
  const usedPercent = weekly.usedPercent;
  const resetAtMs = weekly.resetAtMs;
  if (
    typeof usedPercent !== 'number' ||
    !Number.isFinite(usedPercent) ||
    typeof resetAtMs !== 'number' ||
    !Number.isFinite(resetAtMs) ||
    resetAtMs <= nowMs
  ) {
    return undefined;
  }

  const periodHours =
    typeof weekly.periodHours === 'number' &&
    Number.isFinite(weekly.periodHours) &&
    weekly.periodHours > 0
      ? weekly.periodHours
      : DEFAULT_WEEKLY_WINDOW_HOURS;
  const fromMs = resetAtMs - periodHours * 60 * 60 * 1000;
  if (!Number.isFinite(fromMs) || fromMs >= nowMs) return undefined;

  return {
    key: `codex:${authIndex}:${Math.round(resetAtMs)}`,
    authIndex,
    fromMs,
    resetAtMs,
    usedPercent: Math.max(0, Math.min(100, usedPercent)),
  };
};

const lowerConfidence = (confidence: WeeklyEstimateConfidence): WeeklyEstimateConfidence => {
  if (confidence === 'high') return 'medium';
  return 'low';
};

const resolveConfidence = (
  usedPercent: number,
  range: UsageAccountRangeSummary,
  coverageComplete: boolean
): WeeklyEstimateConfidence => {
  let confidence: WeeklyEstimateConfidence =
    usedPercent >= 30 ? 'high' : usedPercent >= 10 ? 'medium' : 'low';
  if (!coverageComplete) confidence = 'low';
  if (range.unpriced_requests > 0 || range.estimated || range.cache_write_unreported) {
    confidence = lowerConfidence(confidence);
  }
  return confidence;
};

export const resolveWeeklyUsageEstimate = (
  basis: WeeklyUsageBasis,
  range: UsageAccountRangeSummary | undefined,
  storage: UsageStorageStatus,
  requestStatus: 'idle' | 'loading' | 'ready' | 'error'
): WeeklyUsageEstimate => {
  if (basis.usedPercent < MINIMUM_ESTIMATE_USED_PERCENT) {
    return { status: 'sampling', usedPercent: basis.usedPercent };
  }
  if (requestStatus === 'loading' || requestStatus === 'idle') {
    return { status: 'loading', usedPercent: basis.usedPercent };
  }
  if (requestStatus === 'error') {
    return { status: 'unavailable', usedPercent: basis.usedPercent };
  }
  if (!range || range.priced_requests === 0 || range.total_cost_usd <= 0) {
    return { status: 'insufficient', usedPercent: basis.usedPercent };
  }

  const oldestAtMs = Date.parse(storage.oldest_at ?? '');
  const coverageComplete = Number.isFinite(oldestAtMs) && oldestAtMs <= basis.fromMs;
  return {
    status: 'ready',
    usedPercent: basis.usedPercent,
    totalUsd: range.total_cost_usd / (basis.usedPercent / 100),
    windowCostUsd: range.total_cost_usd,
    confidence: resolveConfidence(basis.usedPercent, range, coverageComplete),
    coverageComplete,
    estimated: range.estimated,
    cacheWriteUnreported: range.cache_write_unreported,
  };
};

export const resolveQuotaUsageCost = (
  file: AuthFileItem,
  usageByAuthIndex: ReadonlyMap<string, UsageAccountSummary>,
  storageEnabled: boolean,
  weeklyBasis?: WeeklyUsageBasis,
  weeklyRange?: UsageAccountRangeSummary,
  storage?: UsageStorageStatus,
  weeklyRequestStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle'
): QuotaUsageCost | undefined => {
  if (!storageEnabled) return undefined;
  const authIndex = normalizeAuthIndex(file['auth_index'] ?? file.authIndex);
  if (!authIndex) return undefined;

  const usage = usageByAuthIndex.get(authIndex);
  return {
    totalUsd: usage?.total_cost_usd ?? 0,
    totalRequests: usage?.total_requests ?? 0,
    estimated: usage?.estimated ?? false,
    cacheWriteUnreported: usage?.cache_write_unreported ?? false,
    weekly:
      weeklyBasis && storage
        ? resolveWeeklyUsageEstimate(weeklyBasis, weeklyRange, storage, weeklyRequestStatus)
        : undefined,
  };
};

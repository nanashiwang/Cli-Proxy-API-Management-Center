import type { UsageDimensionSnapshot, UsageRequestDetail, UsageSnapshot } from '@/types/usage';

export type UsageRange = '24h' | '7d' | '30d' | 'all';

export interface UsageTrendPoint {
  key: string;
  label: string;
  cost: number;
  requests: number;
}

export const usageRangeStart = (range: UsageRange, now = new Date()): Date | null => {
  if (range === 'all') return null;
  const hours = range === '24h' ? 24 : range === '7d' ? 7 * 24 : 30 * 24;
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
};

export const flattenUsageDetails = (usage?: UsageSnapshot | null): UsageRequestDetail[] => {
  if (!usage) return [];
  const details: UsageRequestDetail[] = [];
  Object.values(usage.apis ?? {}).forEach((api) => {
    Object.values(api.models ?? {}).forEach((model) => {
      details.push(...(model.details ?? []));
    });
  });
  return details.sort(
    (left, right) => Date.parse(right.timestamp || '') - Date.parse(left.timestamp || '')
  );
};

export const sortedDimensions = (values?: Record<string, UsageDimensionSnapshot>) =>
  Object.entries(values ?? {}).sort((left, right) => {
    if (right[1].total_cost_usd !== left[1].total_cost_usd) {
      return right[1].total_cost_usd - left[1].total_cost_usd;
    }
    return right[1].total_tokens - left[1].total_tokens;
  });

export const buildUsageTrend = (
  details: UsageRequestDetail[],
  range: UsageRange,
  now = new Date()
): UsageTrendPoint[] => {
  const hourly = range === '24h';
  const count = hourly ? 24 : range === '7d' ? 7 : range === '30d' ? 30 : 30;
  const bucketMs = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const formatter = new Intl.DateTimeFormat(
    undefined,
    hourly
      ? { hour: '2-digit' }
      : {
          month: 'short',
          day: 'numeric',
        }
  );
  const end = new Date(now);
  if (hourly) {
    end.setMinutes(0, 0, 0);
  } else {
    end.setHours(0, 0, 0, 0);
  }
  const startMs = end.getTime() - (count - 1) * bucketMs;
  const points = Array.from({ length: count }, (_, index) => {
    const date = new Date(startMs + index * bucketMs);
    return {
      key: date.toISOString(),
      label: formatter.format(date),
      cost: 0,
      requests: 0,
    };
  });
  details.forEach((detail) => {
    const timestamp = Date.parse(detail.timestamp || '');
    if (
      !Number.isFinite(timestamp) ||
      timestamp < startMs ||
      timestamp >= end.getTime() + bucketMs
    ) {
      return;
    }
    const index = Math.floor((timestamp - startMs) / bucketMs);
    if (index < 0 || index >= points.length) return;
    points[index].requests += 1;
    points[index].cost +=
      detail.cost_usd ?? (detail.billing?.priced ? detail.billing.total_usd : 0);
  });
  return points;
};

export const formatUSD = (value: number): string => {
  if (!Number.isFinite(value)) return '$0.00';
  if (Math.abs(value) >= 1000)
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`;
  if (value === 0) return '$0.00';
  return `$${value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`;
};

export const formatTokens = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
};

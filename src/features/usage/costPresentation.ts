import type { UsageRecord } from '@/types/usage';

const amount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Read request-time snapshots only; today's catalog must not reprice old requests. */
export function usageCostRows(record: Pick<UsageRecord, 'billing'>) {
  const prices = record.billing?.pricing?.unit_prices_usd_per_million_tokens;
  // Older Go snapshots serialize absent rates as four zeros. A paid request
  // cannot have an entirely free rate card; keep its rates unknown.
  const missingRates =
    (amount(record.billing?.total_usd) ?? 0) > 0 &&
    prices &&
    Object.values(prices).every((price) => price === 0);
  return (['input', 'output', 'cache_read', 'cache_write'] as const).map((key) => ({
    key,
    unitPrice: record.billing?.priced && !missingRates ? amount(prices?.[key]) : null,
    cost: record.billing?.priced ? amount(record.billing.breakdown?.[`${key}_usd`]) : null,
  }));
}

export function usageRecordedCost(record: Pick<UsageRecord, 'billing' | 'cost_usd'>) {
  return record.billing?.priced
    ? (amount(record.cost_usd) ?? amount(record.billing.total_usd))
    : null;
}

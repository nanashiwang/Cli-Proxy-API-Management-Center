import type { UsageFilters, UsageRange, UsageRecord } from '@/types/usage';
import { usageRangeStart } from './utils';
import { usageModelObservation } from './modelObservation';

export function formatDuration(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value >= 1000
    ? `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)} s`
    : `${Math.round(value)} ms`;
}

export function formatRate(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(1)}%`;
}

export function customRangeFilters(
  from: string,
  to: string
): Pick<UsageFilters, 'from' | 'to'> | null {
  const start = new Date(from);
  const end = new Date(to);
  if (
    !from ||
    !to ||
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start >= end
  )
    return null;
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Freeze the end time for pagination and never mix presets with explicit bounds. */
export function usageTimeFilters(
  range: UsageRange | 'custom',
  snapshotAt: Date,
  custom: Pick<UsageFilters, 'from' | 'to'> | null
): Pick<UsageFilters, 'from' | 'to'> | null {
  if (range === 'custom') return custom;
  const start = usageRangeStart(range, snapshotAt);
  return { ...(start ? { from: start.toISOString() } : {}), to: snapshotAt.toISOString() };
}

export function usageRecordAccount(record: UsageRecord): string {
  return record.auth_id || record.source || record.account || '—';
}

export function usageEndpointUnavailable(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

/** A strict allowlist: never export credentials, account names, payloads or arbitrary metadata. */
export function usageDiagnosticBundle(record: UsageRecord, now = new Date()) {
  const model = usageModelObservation(record);
  const number = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  return {
    schema_version: 1,
    source: 'cpa.usage_record',
    exported_at: now.toISOString(),
    policy: 'allowlisted_metrics_without_payloads_or_account_identifiers',
    record: {
      id: record.id,
      request_id: record.request_id || null,
      timestamp: record.timestamp,
      failed: record.failed,
      status_code: number(record.status_code),
      latency_ms: number(record.latency_ms),
      ttft_ms: number(record.ttft_ms),
      generate: record.generate,
      model_match: model.match,
      upstream_response_model_source: model.source,
      tokens: {
        input_tokens: number(record.tokens.input_tokens),
        output_tokens: number(record.tokens.output_tokens),
        cache_read_tokens: number(record.tokens.cache_read_tokens),
        cache_write_tokens: number(record.tokens.cache_write_tokens),
        reasoning_tokens: number(record.tokens.reasoning_tokens),
        total_tokens: number(record.tokens.total_tokens),
      },
      billing: {
        priced: record.billing?.priced ?? false,
        estimated: record.billing?.pricing?.estimated ?? null,
        total_usd: record.billing?.priced
          ? number(record.cost_usd ?? record.billing.total_usd)
          : null,
        input_usd: record.billing?.priced ? number(record.billing?.breakdown?.input_usd) : null,
        output_usd: record.billing?.priced ? number(record.billing?.breakdown?.output_usd) : null,
        cache_read_usd: record.billing?.priced
          ? number(record.billing?.breakdown?.cache_read_usd)
          : null,
        cache_write_usd: record.billing?.priced
          ? number(record.billing?.breakdown?.cache_write_usd)
          : null,
      },
    },
    availability: { attempts: 'not_collected', trace: 'not_collected', payloads: 'not_included' },
    omitted: [
      'account_identifiers',
      'api_keys',
      'model_names',
      'source_paths',
      'headers',
      'bodies',
      'logs',
      'metadata',
    ],
  };
}

/** Separate line segments so an unavailable sample is never drawn as zero or bridged. */
export function chartLineSegments(
  values: Array<number | null>,
  x: (index: number) => number,
  y: (value: number) => number
) {
  const paths: string[] = [];
  let path = '';
  values.forEach((value, index) => {
    if (value == null || !Number.isFinite(value)) {
      if (path) paths.push(path);
      path = '';
    } else {
      path += `${path ? ' L' : 'M'}${x(index)},${y(value)}`;
    }
  });
  if (path) paths.push(path);
  return paths;
}

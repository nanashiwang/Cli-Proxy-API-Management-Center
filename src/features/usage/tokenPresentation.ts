import type { UsageRecord } from '@/types/usage';

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** v2 input/output totals already contain cache/reasoning; never add those twice. */
export function usageTokenMetrics(record: Pick<UsageRecord, 'tokens' | 'token_breakdown'>) {
  const b = record.token_breakdown;
  const valid =
    b?.schema_version === 2 &&
    ['complete', 'unclassified', 'inconsistent'].includes(b.quality) &&
    [
      b.total_tokens,
      b.unclassified_tokens,
      b.input?.total_tokens,
      b.input?.uncached_tokens,
      b.input?.cache_read_tokens,
      b.input?.cache_write_tokens,
      b.output?.total_tokens,
      b.output?.non_reasoning_tokens,
      b.output?.reasoning_tokens,
    ].every((value) => count(value) !== null) &&
    b.input.total_tokens ===
      b.input.uncached_tokens + b.input.cache_read_tokens + b.input.cache_write_tokens &&
    b.output.total_tokens === b.output.non_reasoning_tokens + b.output.reasoning_tokens &&
    b.total_tokens === b.input.total_tokens + b.output.total_tokens + b.unclassified_tokens &&
    (b.quality !== 'complete' || b.unclassified_tokens === 0);

  if (valid && b) {
    const unpartitioned =
      b.quality === 'inconsistent' ||
      (b.total_tokens > 0 && b.unclassified_tokens === b.total_tokens);
    return {
      input: unpartitioned ? null : b.input.total_tokens,
      output: unpartitioned ? null : b.output.total_tokens,
      cacheRead: unpartitioned ? null : b.input.cache_read_tokens,
      cacheWrite: unpartitioned ? null : b.input.cache_write_tokens,
      reasoning: unpartitioned ? null : b.output.reasoning_tokens,
      total: b.total_tokens,
      unclassified: b.unclassified_tokens,
      quality: b.quality,
    };
  }

  // Historical fields do not establish whether buckets overlap. Keep stored values.
  return {
    input: count(record.tokens.input_tokens),
    output: count(record.tokens.output_tokens),
    cacheRead: count(record.tokens.cache_read_tokens ?? record.tokens.cached_tokens),
    cacheWrite: count(record.tokens.cache_write_tokens),
    reasoning: count(record.tokens.reasoning_tokens),
    total: count(record.tokens.total_tokens),
    unclassified: null,
    quality: 'unavailable' as const,
  };
}

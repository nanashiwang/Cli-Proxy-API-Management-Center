import { describe, expect, test } from 'bun:test';
import { usageTokenMetrics } from '../src/features/usage/tokenPresentation';
import type { UsageRecord } from '../src/types/usage';

type TokenRecord = Pick<UsageRecord, 'tokens' | 'token_breakdown'>;
const canonical = (): TokenRecord => ({
  tokens: {
    input_tokens: 460,
    output_tokens: 66,
    cache_read_tokens: 21700,
    cached_tokens: 21700,
    cache_write_tokens: 0,
    reasoning_tokens: 17,
    total_tokens: 22243,
  },
  token_breakdown: {
    schema_version: 2,
    quality: 'complete',
    total_tokens: 22243,
    unclassified_tokens: 0,
    input: {
      total_tokens: 22160,
      uncached_tokens: 460,
      cache_read_tokens: 21700,
      cache_write_tokens: 0,
    },
    output: { total_tokens: 83, non_reasoning_tokens: 66, reasoning_tokens: 17 },
  },
});

describe('usage token display accounting', () => {
  test('shows inclusive input and output without adding cache or reasoning twice', () => {
    expect(usageTokenMetrics(canonical())).toEqual({
      input: 22160,
      output: 83,
      cacheRead: 21700,
      cacheWrite: 0,
      reasoning: 17,
      total: 22243,
      unclassified: 0,
      quality: 'complete',
    });
  });

  test('uses the same canonical totals for independent cache-write and reasoning buckets', () => {
    const record = canonical();
    record.token_breakdown = {
      schema_version: 2,
      quality: 'complete',
      total_tokens: 476,
      unclassified_tokens: 0,
      input: {
        total_tokens: 450,
        uncached_tokens: 100,
        cache_read_tokens: 300,
        cache_write_tokens: 50,
      },
      output: { total_tokens: 26, non_reasoning_tokens: 16, reasoning_tokens: 10 },
    };
    const metrics = usageTokenMetrics(record);
    expect(metrics.input).toBe(450);
    expect(metrics.output).toBe(26);
    expect(metrics.cacheWrite).toBe(50);
    expect(metrics.total).toBe(476);
  });

  test('does not infer overlap or inflate historical stored values', () => {
    const record = canonical();
    delete record.token_breakdown;
    record.tokens.input_tokens = 22160;
    record.tokens.output_tokens = 83;
    const metrics = usageTokenMetrics(record);
    expect(metrics.input).toBe(22160);
    expect(metrics.output).toBe(83);
    expect(metrics.total).toBe(22243);
    expect(metrics.quality).toBe('unavailable');
  });

  test('preserves an unclassified total without presenting unknown partitions as zero', () => {
    for (const quality of ['unclassified', 'inconsistent'] as const) {
      const record = canonical();
      record.token_breakdown = {
        schema_version: 2,
        quality,
        total_tokens: 100,
        unclassified_tokens: 100,
        input: { total_tokens: 0, uncached_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 },
        output: { total_tokens: 0, non_reasoning_tokens: 0, reasoning_tokens: 0 },
      };
      const metrics = usageTokenMetrics(record);
      expect(metrics.input).toBeNull();
      expect(metrics.output).toBeNull();
      expect(metrics.cacheRead).toBeNull();
      expect(metrics.total).toBe(100);
      expect(metrics.unclassified).toBe(100);
    }
  });

  test('retains known portions of a partially classified record', () => {
    const record = canonical();
    record.token_breakdown!.quality = 'unclassified';
    record.token_breakdown!.unclassified_tokens = 7;
    record.token_breakdown!.total_tokens += 7;
    const metrics = usageTokenMetrics(record);
    expect(metrics.input).toBe(22160);
    expect(metrics.output).toBe(83);
    expect(metrics.unclassified).toBe(7);
    expect(metrics.total).toBe(22250);
  });

  test('rejects contradictory canonical partitions and leaves the original stored total intact', () => {
    const record = canonical();
    record.token_breakdown!.input.cache_write_tokens = 6300;
    expect(usageTokenMetrics(record).quality).toBe('unavailable');
    expect(usageTokenMetrics(record).total).toBe(22243);
  });
});

import { describe, expect, test } from 'bun:test';
import {
  chartLineSegments,
  customRangeFilters,
  formatDuration,
  formatRate,
  usageDiagnosticBundle,
  usageEndpointUnavailable,
  usageTimeFilters,
} from '../src/features/usage/analytics';
import type { UsageRecord } from '../src/types/usage';

const record = {
  id: 'record-1',
  request_id: 'req-1',
  timestamp: '2026-09-19T00:00:00Z',
  auth_id: 'private@example.com',
  account: 'secret-account',
  api: 'sk-client-secret',
  model: 'private-model-name',
  source: '/private/secrets/provider.json',
  provider: 'test',
  failed: false,
  status_code: 200,
  latency_ms: 1200,
  ttft_ms: 150,
  generate: true,
  tokens: {
    input_tokens: 10,
    output_tokens: 5,
    cache_read_tokens: 15,
    cache_write_tokens: 0,
    reasoning_tokens: 4,
    total_tokens: 34,
  },
  billing: {
    priced: true,
    total_usd: 0.0001,
    pricing: { estimated: false, source: 'private-price-url?key=secret' },
    breakdown: {
      input_usd: 0.00004,
      output_usd: 0.00003,
      cache_read_usd: 0.00003,
      cache_write_usd: 0,
    },
  },
  arbitrary_metadata: { authorization: 'Bearer private-key' },
} as unknown as UsageRecord;

describe('usage analytics semantics', () => {
  test('freezes explicit range bounds and does not mix range with from/to', () => {
    const snapshotAt = new Date('2026-09-19T03:00:00Z');
    expect(usageTimeFilters('7d', snapshotAt, null)).toEqual({
      from: '2026-09-12T03:00:00.000Z',
      to: '2026-09-19T03:00:00.000Z',
    });
    expect(usageTimeFilters('all', snapshotAt, null)).toEqual({ to: '2026-09-19T03:00:00.000Z' });
    expect(usageTimeFilters('custom', snapshotAt, null)).toBeNull();
  });
  test('rejects missing, reversed, equal and invalid custom bounds', () => {
    expect(customRangeFilters('', '')).toBeNull();
    expect(customRangeFilters('bad-date', '2026-09-19T10:00')).toBeNull();
    expect(customRangeFilters('2026-09-19T10:00', '2026-09-19T09:00')).toBeNull();
    expect(customRangeFilters('2026-09-19T10:00', '2026-09-19T10:00')).toBeNull();
    expect(customRangeFilters('2026-09-19T09:00:00Z', '2026-09-19T10:00:00Z')).toEqual({
      from: '2026-09-19T09:00:00.000Z',
      to: '2026-09-19T10:00:00.000Z',
    });
  });
  test('does not bridge missing performance samples and retains genuine zero', () => {
    expect(
      chartLineSegments(
        [0, 20, null, 40, Number.NaN, 50],
        (i) => i * 10,
        (v) => 100 - v
      )
    ).toEqual(['M0,100 L10,80', 'M30,60', 'M50,50']);
    expect(
      chartLineSegments(
        [null, null],
        (i) => i,
        (v) => v
      )
    ).toEqual([]);
  });
  test('distinguishes unavailable timing and rate from measured zero', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(1200)).toBe('1.20 s');
    expect(formatRate(null)).toBe('—');
    expect(formatRate(0)).toBe('0.0%');
  });
  test('identifies unsupported analytics API without mislabeling auth/server errors', () => {
    expect(usageEndpointUnavailable({ status: 404 })).toBe(true);
    expect(usageEndpointUnavailable({ status: 401 })).toBe(false);
    expect(usageEndpointUnavailable({ status: 500 })).toBe(false);
    expect(usageEndpointUnavailable(new Error('network'))).toBe(false);
  });
});

describe('diagnostic export allowlist', () => {
  test('exports numeric metrics and correlation IDs without account, key, payload or arbitrary metadata', () => {
    const bundle = usageDiagnosticBundle(record, new Date('2026-09-19T12:00:00Z'));
    const text = JSON.stringify(bundle);
    for (const sensitive of [
      'private@example.com',
      'secret-account',
      'sk-client-secret',
      'private-model-name',
      '/private/secrets',
      'private-key',
      'private-price-url',
    ])
      expect(text).not.toContain(sensitive);
    expect(bundle.record.tokens.total_tokens).toBe(34);
    expect(bundle.record.request_id).toBe('req-1');
    expect(bundle.availability.trace).toBe('not_collected');
    expect(bundle.availability.attempts).toBe('not_collected');
  });
  test('preserves unknown pricing as null instead of reporting zero-cost breakdowns', () => {
    const unpriced = { ...record, billing: { ...record.billing, priced: false, total_usd: 0 } };
    expect(usageDiagnosticBundle(unpriced).record.billing).toEqual({
      priced: false,
      estimated: false,
      total_usd: null,
      input_usd: null,
      output_usd: null,
      cache_read_usd: null,
      cache_write_usd: null,
    });
  });
  test('keeps genuinely free priced requests at zero cost', () => {
    const free = {
      ...record,
      cost_usd: 0,
      billing: { ...record.billing, priced: true, total_usd: 0 },
    };
    expect(usageDiagnosticBundle(free).record.billing.total_usd).toBe(0);
  });
});

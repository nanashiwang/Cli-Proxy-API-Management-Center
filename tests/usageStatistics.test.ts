import { describe, expect, test } from 'bun:test';
import {
  buildUsageTrend,
  flattenUsageDetails,
  formatTokens,
  formatUSD,
  sortedDimensions,
  usageRangeStart,
} from '../src/features/usage/utils';
import type { UsageRequestDetail, UsageSnapshot } from '../src/types/usage';

const detail = (timestamp: string, cost: number): UsageRequestDetail => ({
  timestamp,
  latency_ms: 100,
  ttft_ms: 20,
  provider: 'openai',
  executor_type: 'codex',
  alias: 'gpt-5.6',
  endpoint: '/v1/responses',
  source: 'account@example.com',
  auth_id: 'account@example.com',
  auth_index: '0',
  auth_type: 'oauth',
  service_tier: 'default',
  tokens: {
    input_tokens: 10,
    output_tokens: 5,
    reasoning_tokens: 0,
    cached_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    total_tokens: 15,
  },
  failed: false,
  status_code: 200,
  generate: true,
  billing: {
    currency: 'USD',
    priced: true,
    total_usd: cost,
    breakdown: { input_usd: cost, output_usd: 0, cache_read_usd: 0, cache_write_usd: 0 },
    pricing: {
      version: 'test',
      source: 'test',
      matched_model: 'gpt-5.6',
      service_tier: 'default',
      estimated: false,
      calculated_at: timestamp,
    },
  },
  cost_usd: cost,
});

describe('usage statistics helpers', () => {
  test('flattens and sorts request details', () => {
    const usage = {
      apis: {
        api: {
          total_requests: 2,
          total_tokens: 30,
          total_cost_usd: 0.3,
          models: {
            model: {
              total_requests: 2,
              total_tokens: 30,
              total_cost_usd: 0.3,
              details: [
                detail('2026-08-17T10:00:00Z', 0.1),
                detail('2026-08-17T11:00:00Z', 0.2),
              ],
            },
          },
        },
      },
    } as UsageSnapshot;
    expect(flattenUsageDetails(usage).map((item) => item.cost_usd)).toEqual([0.2, 0.1]);
  });

  test('sorts dimensions by cost then tokens', () => {
    const common = {
      total_requests: 1,
      success_count: 1,
      failure_count: 0,
      priced_requests: 1,
      unpriced_requests: 0,
      total_tokens: 10,
      tokens: {
        input_tokens: 10,
        output_tokens: 0,
        reasoning_tokens: 0,
        cached_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        total_tokens: 10,
      },
    };
    expect(
      sortedDimensions({
        low: { ...common, total_cost_usd: 1 },
        high: { ...common, total_cost_usd: 2 },
      }).map(([name]) => name)
    ).toEqual(['high', 'low']);
  });

  test('builds hourly cost trend and range start', () => {
    const now = new Date('2026-08-17T12:30:00Z');
    const trend = buildUsageTrend(
      [detail('2026-08-17T11:15:00Z', 0.25), detail('2026-08-17T12:05:00Z', 0.5)],
      '24h',
      now
    );
    expect(trend.at(-2)?.cost).toBeCloseTo(0.25);
    expect(trend.at(-1)?.cost).toBeCloseTo(0.5);
    expect(usageRangeStart('24h', now)?.toISOString()).toBe('2026-08-16T12:30:00.000Z');
  });

  test('formats cost and token values', () => {
    expect(formatUSD(0.000123)).toBe('$0.000123');
    expect(formatUSD(12.5)).toBe('$12.50');
    expect(formatTokens(1_250_000)).toBe('1.25M');
  });
});

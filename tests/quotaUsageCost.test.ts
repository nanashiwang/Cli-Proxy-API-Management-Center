import { describe, expect, test } from 'bun:test';
import {
  buildAccountUsageByAuthIndex,
  resolveQuotaUsageCost,
} from '../src/features/quota/usageCost';
import type { UsageAccountSummary } from '../src/types/usage';

const account = (authIndex: string, cost: number): UsageAccountSummary => ({
  key: `auth_index:${authIndex}`,
  auth_index: authIndex,
  provider: 'codex',
  estimated: true,
  cache_write_unreported: true,
  total_requests: 3,
  success_count: 3,
  failure_count: 0,
  priced_requests: 3,
  unpriced_requests: 0,
  total_tokens: 100,
  tokens: {
    input_tokens: 100,
    output_tokens: 0,
    reasoning_tokens: 0,
    cached_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    total_tokens: 100,
  },
  total_cost_usd: cost,
});

describe('quota account usage cost', () => {
  test('matches account usage by normalized auth index', () => {
    const usage = buildAccountUsageByAuthIndex([account('42', 1.25)]);
    expect(resolveQuotaUsageCost({ name: 'codex.json', authIndex: 42 }, usage, true)).toEqual({
      totalUsd: 1.25,
      totalRequests: 3,
      estimated: true,
      cacheWriteUnreported: true,
    });
  });

  test('shows zero for an account without retained requests', () => {
    expect(
      resolveQuotaUsageCost({ name: 'unused.json', authIndex: 'unused' }, new Map(), true)
    ).toEqual({
      totalUsd: 0,
      totalRequests: 0,
      estimated: false,
      cacheWriteUnreported: false,
    });
  });

  test('hides cost when statistics are disabled or identity is missing', () => {
    const usage = buildAccountUsageByAuthIndex([account('42', 1.25)]);
    expect(resolveQuotaUsageCost({ name: 'codex.json', authIndex: '42' }, usage, false)).toBe(
      undefined
    );
    expect(resolveQuotaUsageCost({ name: 'codex.json' }, usage, true)).toBe(undefined);
  });
});

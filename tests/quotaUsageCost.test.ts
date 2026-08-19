import { describe, expect, test } from 'bun:test';
import {
  buildAccountUsageByAuthIndex,
  resolveCodexWeeklyUsageBasis,
  resolveQuotaUsageCost,
  resolveWeeklyUsageEstimate,
} from '../src/features/quota/usageCost';
import {
  appendWeeklyUsageSample,
  getWeeklyUsageSamples,
} from '../src/features/quota/weeklyUsageHistory';
import type {
  UsageAccountRangeSummary,
  UsageAccountSummary,
  UsageStorageStatus,
} from '../src/types/usage';

const tokenStats = {
  input_tokens: 100,
  output_tokens: 0,
  reasoning_tokens: 0,
  cached_tokens: 0,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  total_tokens: 100,
};

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
  tokens: tokenStats,
  total_cost_usd: cost,
});

const range = (cost: number): UsageAccountRangeSummary => ({
  key: 'codex:42:1787205600000',
  auth_index: '42',
  from: '2026-08-13T11:30:00.000Z',
  to: '2026-08-19T03:30:00.000Z',
  estimated: false,
  cache_write_unreported: false,
  total_requests: 10,
  success_count: 10,
  failure_count: 0,
  priced_requests: 10,
  unpriced_requests: 0,
  total_tokens: 100,
  tokens: tokenStats,
  total_cost_usd: cost,
});

const storage = (oldestAt: string): UsageStorageStatus => ({
  enabled: true,
  retention_days: 30,
  max_records: 100_000,
  record_count: 10,
  file_size_bytes: 1024,
  oldest_at: oldestAt,
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

  test('uses the primary Codex weekly window instead of the Spark weekly window', () => {
    const nowMs = Date.parse('2026-08-19T03:30:00.000Z');
    const resetAtMs = Date.parse('2026-08-20T11:30:00.000Z');
    const basis = resolveCodexWeeklyUsageBasis(
      { name: 'codex.json', authIndex: '42' },
      {
        status: 'success',
        windows: [
          {
            id: 'gpt-5-3-codex-spark-weekly-0',
            label: 'Spark weekly',
            usedPercent: 0,
            resetLabel: '',
            resetAtMs: resetAtMs + 8 * 60 * 60 * 1000,
            periodHours: 168,
          },
          {
            id: 'weekly',
            label: 'Weekly',
            usedPercent: 96,
            resetLabel: '',
            resetAtMs,
            periodHours: 168,
          },
        ],
      },
      nowMs
    );

    expect(basis).toEqual({
      key: `codex:42:${resetAtMs}`,
      authIndex: '42',
      fromMs: resetAtMs - 168 * 60 * 60 * 1000,
      resetAtMs,
      usedPercent: 96,
    });
  });

  test('estimates the weekly value from cost and official usage deltas', () => {
    const basis = {
      key: 'codex:42:1787205600000',
      authIndex: '42',
      fromMs: Date.parse('2026-08-13T11:30:00.000Z'),
      resetAtMs: Date.parse('2026-08-20T11:30:00.000Z'),
      usedPercent: 23,
    };
    const estimate = resolveWeeklyUsageEstimate(
      basis,
      range(61.75),
      storage('2026-08-12T00:00:00.000Z'),
      'ready',
      [
        {
          capturedAtMs: Date.parse('2026-08-19T02:30:00.000Z'),
          costUsd: 60,
          usedPercent: 20,
        },
      ],
      Date.parse('2026-08-19T03:30:00.000Z')
    );

    expect(estimate.status).toBe('ready');
    expect(estimate.totalUsd).toBeCloseTo(58.3333333333, 10);
    expect(estimate.windowCostUsd).toBe(61.75);
    expect(estimate.sampledCostUsd).toBeCloseTo(1.75, 10);
    expect(estimate.sampledPercent).toBe(3);
    expect(estimate.confidence).toBe('low');
  });

  test('keeps estimates in sampling state without a historical baseline', () => {
    const estimate = resolveWeeklyUsageEstimate(
      {
        key: 'codex:42:1787205600000',
        authIndex: '42',
        fromMs: Date.parse('2026-08-13T11:30:00.000Z'),
        resetAtMs: Date.parse('2026-08-20T11:30:00.000Z'),
        usedPercent: 23,
      },
      range(61.75),
      storage('2026-08-12T00:00:00.000Z'),
      'ready'
    );

    expect(estimate).toEqual({ status: 'sampling', usedPercent: 23 });
  });

  test('keeps estimates in sampling state when the usage delta is too small', () => {
    const estimate = resolveWeeklyUsageEstimate(
      {
        key: 'codex:42:1787205600000',
        authIndex: '42',
        fromMs: Date.parse('2026-08-13T11:30:00.000Z'),
        resetAtMs: Date.parse('2026-08-20T11:30:00.000Z'),
        usedPercent: 21,
      },
      range(62),
      storage('2026-08-12T00:00:00.000Z'),
      'ready',
      [
        {
          capturedAtMs: Date.parse('2026-08-19T02:30:00.000Z'),
          costUsd: 60,
          usedPercent: 20,
        },
      ],
      Date.parse('2026-08-19T03:30:00.000Z')
    );

    expect(estimate).toEqual({ status: 'sampling', usedPercent: 21 });
  });

  test('does not estimate across a project statistics reset', () => {
    const estimate = resolveWeeklyUsageEstimate(
      {
        key: 'codex:42:1787205600000',
        authIndex: '42',
        fromMs: Date.parse('2026-08-13T11:30:00.000Z'),
        resetAtMs: Date.parse('2026-08-20T11:30:00.000Z'),
        usedPercent: 23,
      },
      range(0),
      storage('2026-08-19T03:00:00.000Z'),
      'ready',
      [
        {
          capturedAtMs: Date.parse('2026-08-19T02:30:00.000Z'),
          costUsd: 60,
          usedPercent: 20,
        },
      ],
      Date.parse('2026-08-19T03:30:00.000Z')
    );

    expect(estimate).toEqual({ status: 'sampling', usedPercent: 23 });
  });

  test('starts a new sampling segment after a project statistics reset', () => {
    const basis = { key: 'codex:42:1787205600000' };
    const history = {
      samplesByKey: {
        [basis.key]: [
          {
            capturedAtMs: Date.parse('2026-08-19T02:30:00.000Z'),
            costUsd: 60,
            usedPercent: 20,
          },
        ],
      },
    };
    const next = appendWeeklyUsageSample(
      history,
      basis,
      {
        capturedAtMs: Date.parse('2026-08-19T03:30:00.000Z'),
        costUsd: 0,
        usedPercent: 23,
      },
      Date.parse('2026-08-19T03:30:00.000Z')
    );

    expect(getWeeklyUsageSamples(next, basis.key)).toEqual([
      {
        capturedAtMs: Date.parse('2026-08-19T03:30:00.000Z'),
        costUsd: 0,
        usedPercent: 23,
      },
    ]);
  });

  test('lowers confidence when retained statistics do not cover the whole weekly window', () => {
    const estimate = resolveWeeklyUsageEstimate(
      {
        key: 'codex:42:1787205600000',
        authIndex: '42',
        fromMs: Date.parse('2026-08-13T11:30:00.000Z'),
        resetAtMs: Date.parse('2026-08-20T11:30:00.000Z'),
        usedPercent: 96,
      },
      range(19.2),
      storage('2026-08-18T00:00:00.000Z'),
      'ready',
      [
        {
          capturedAtMs: Date.parse('2026-08-18T23:30:00.000Z'),
          costUsd: 18.2,
          usedPercent: 90,
        },
      ],
      Date.parse('2026-08-19T03:30:00.000Z')
    );

    expect(estimate.status).toBe('ready');
    expect(estimate.coverageComplete).toBeFalse();
    expect(estimate.confidence).toBe('low');
  });
});

import { describe, expect, test } from 'bun:test';
import {
  HOUR_MS,
  CAPACITY_FRESH_MS,
  buildCapacityAccounts,
  capacityHistoryKey,
  capacityStorageKey,
  estimateCapacity,
  readCapacityHistory,
  recordCapacitySamples,
  writeCapacityHistory,
  type CapacityAccount,
  type CapacityHistory,
} from '../src/features/quota/capacityEstimate';
import type { AuthFileItem, CodexQuotaState } from '../src/types';

const NOW = Date.UTC(2026, 8, 7, 12);
const account = (key: string, used = 40, periodHours = 168, resetHours = 24): CapacityAccount => ({
  key,
  plan: 'plus',
  available: true,
  windows: [
    {
      id: periodHours === 5 ? 'five-hour' : 'weekly',
      periodHours,
      atMs: NOW,
      used,
      resetAtMs: NOW + resetHours * HOUR_MS,
    },
  ],
});
const historyFor = (accounts: CapacityAccount[], rates: number[]): CapacityHistory =>
  Object.fromEntries(
    accounts.flatMap((a, i) =>
      a.windows.map((w) => [
        capacityHistoryKey(a, w),
        [
          { atMs: NOW - HOUR_MS / 2, used: w.used - rates[i] / 2, resetAtMs: w.resetAtMs },
          { atMs: NOW, used: w.used, resetAtMs: w.resetAtMs },
        ],
      ])
    )
  );

const quota = (used = 20): CodexQuotaState => ({
  status: 'success',
  capturedAtMs: NOW,
  planType: 'plus',
  windows: [
    {
      id: 'weekly',
      label: 'Week',
      usedPercent: used,
      resetLabel: '',
      periodHours: 168,
      resetAtMs: NOW + HOUR_MS,
    },
  ],
});

describe('lightweight quota capacity estimates', () => {
  test('14 accounts consuming 12 pp/hour need 21 total, not 12 accounts per hour', () => {
    const accounts = Array.from({ length: 14 }, (_, i) => account(String(i)));
    const [result] = estimateCapacity(
      accounts,
      historyFor(
        accounts,
        accounts.map(() => 12 / 14)
      ),
      NOW
    );
    expect(result.status).toBe('ready');
    expect(result.windows[0].rate).toBeCloseTo(12);
    expect(result.windows[0].requiredAccounts).toBe(21);
    expect(result.additionalAccounts).toBe(7);
    expect(result.bridgeAccounts).toBe(0);
  });

  test('60 remaining points at 12/hour last 5 hours; next reset at 8 hours needs one account', () => {
    const accounts = [account('a', 40, 168, 8)];
    const [result] = estimateCapacity(accounts, historyFor(accounts, [12]), NOW);
    expect(result.windows[0].runwayHours).toBe(5);
    expect(result.windows[0].recoveryHours).toBe(8);
    expect(result.bridgeAccounts).toBe(1);
    expect(result.additionalAccounts).toBe(20);
  });

  test('takes the maximum across windows rather than adding the counts', () => {
    const a = account('a', 90);
    a.windows.push(...account('a', 50, 5, 2).windows);
    const [result] = estimateCapacity([a], historyFor([a], [20]), NOW);
    expect(result.windows.map((w) => w.requiredAccounts)).toEqual([34, 1]);
    expect(result.additionalAccounts).toBe(33);
  });

  test('keeps different plans separate', () => {
    const accounts = [account('a'), { ...account('b'), plan: 'pro' }];
    const result = estimateCapacity(accounts, historyFor(accounts, [1, 2]), NOW);
    expect(result.map((g) => g.accounts)).toEqual([1, 1]);
    expect(result.map((g) => g.additionalAccounts)).toEqual([1, 3]);
  });

  test('requires samples for every account, not just the currently loaded page', () => {
    const accounts = [account('a'), account('b')];
    const [result] = estimateCapacity(accounts, historyFor([accounts[0]], [2]), NOW);
    expect(result.status).toBe('sampling');
    expect(result.windows[0].sampledAccounts).toBe(1);
    expect(result.additionalAccounts).toBeNull();
  });

  test('first snapshot and too-short observations do not produce zero recommendations', () => {
    const accounts = [account('a')];
    let history = recordCapacitySamples({}, accounts, NOW);
    expect(estimateCapacity(accounts, history, NOW)[0].status).toBe('sampling');
    history = {
      [capacityHistoryKey(accounts[0], accounts[0].windows[0])]: [
        {
          ...accounts[0].windows[0],
          atMs: NOW - 60_000,
          used: 39,
        },
      ],
    };
    expect(estimateCapacity(accounts, history, NOW)[0].additionalAccounts).toBeNull();
  });

  test('zero consumption means insufficient evidence, not infinite runway or no shortage', () => {
    const accounts = [account('a')];
    const [result] = estimateCapacity(accounts, historyFor(accounts, [0]), NOW);
    expect(result.status).toBe('idle');
    expect(result.windows[0].runwayHours).toBeNull();
    expect(result.additionalAccounts).toBeNull();
  });

  test('fully exhausted pools censor demand instead of reporting zero additions', () => {
    const accounts = [account('a', 100), account('b', 100)];
    const [result] = estimateCapacity(accounts, historyFor(accounts, [10, 10]), NOW);
    expect(result.status).toBe('limited');
    expect(result.additionalAccounts).toBeNull();
    expect(result.bridgeAccounts).toBeNull();
  });

  test('partial exhaustion retains a flagged rough estimate when other accounts still serve demand', () => {
    const accounts = [account('a', 100), account('b', 50)];
    const [result] = estimateCapacity(accounts, historyFor(accounts, [0, 10]), NOW);
    expect(result.status).toBe('ready');
    expect(result.limitedAccounts).toBe(1);
    expect(result.windows[0].rate).toBe(10);
  });

  test('disjoint exhausted windows can block every account without exhausting one whole window', () => {
    const a = account('a', 100);
    a.windows.push(...account('a', 40, 5, 2).windows);
    const b = account('b', 40);
    b.windows.push(...account('b', 100, 5, 2).windows);
    const [result] = estimateCapacity([a, b], historyFor([a, b], [5, 5]), NOW);
    expect(result.status).toBe('limited');
    expect(result.additionalAccounts).toBeNull();
  });

  test('stale snapshots, past reset times and failed accounts prevent counts', () => {
    const original = account('a');
    const history = historyFor([original], [5]);
    expect(estimateCapacity([original], history, NOW + CAPACITY_FRESH_MS + 1)[0].status).toBe(
      'incomplete'
    );
    const past = account('b', 20, 168, 0);
    expect(estimateCapacity([past], history, NOW)[0].status).toBe('incomplete');
    expect(
      estimateCapacity([{ ...original, available: false }], history, NOW)[0].additionalAccounts
    ).toBeNull();
  });

  test('unknown plan and mismatched windows cannot silently shrink the pool', () => {
    const a = account('a');
    const unknown = { ...account('b'), plan: null };
    expect(
      estimateCapacity([a, unknown], historyFor([a], [2]), NOW).every(
        (g) => g.status === 'incomplete'
      )
    ).toBe(true);
    const b = account('b', 40, 5, 2);
    expect(estimateCapacity([a, b], historyFor([a, b], [2, 2]), NOW)[0].status).toBe('incomplete');
  });

  test('projects balances to now without extending the current window past a reset', () => {
    const accounts = [account('a', 40, 168, 8)];
    const [result] = estimateCapacity(accounts, historyFor(accounts, [12]), NOW + HOUR_MS / 4);
    expect(result.windows[0].remaining).toBe(57);
    expect(result.windows[0].runwayHours).toBe(4.75);
    expect(result.windows[0].recoveryHours).toBe(7.75);
  });

  test('deduplicates identities and excludes disabled credentials', () => {
    const files: AuthFileItem[] = [
      { name: 'a', auth_index: 'shared' },
      { name: 'b', auth_index: 'shared' },
      { name: 'c', disabled: true },
    ];
    expect(buildCapacityAccounts(files, { a: quota(), b: quota(), c: quota() })).toHaveLength(1);
  });

  test('missing timestamps, invalid percentages and unknown periods are not invented', () => {
    const q = quota();
    delete q.capturedAtMs;
    expect(buildCapacityAccounts([{ name: 'a' }], { a: q })[0].windows).toHaveLength(0);
    for (const used of [NaN, Infinity, -1, 101]) {
      expect(buildCapacityAccounts([{ name: 'a' }], { a: quota(used) })[0].windows).toHaveLength(0);
    }
    const missingPeriod = quota();
    delete missingPeriod.windows[0].periodHours;
    expect(buildCapacityAccounts([{ name: 'a' }], { a: missingPeriod })[0].windows).toHaveLength(0);
  });

  test('one invalid ordinary window prevents recommendations even when another is valid', () => {
    const q = quota();
    q.windows.push({ ...q.windows[0], id: 'five-hour', usedPercent: null, periodHours: 5 });
    const accounts = buildCapacityAccounts([{ name: 'a' }], { a: q });
    expect(accounts[0].windows).toHaveLength(1);
    expect(accounts[0].available).toBe(false);
    expect(estimateCapacity(accounts, {}, NOW)[0].status).toBe('incomplete');
  });

  test('special model and code-review windows are not mixed into ordinary demand', () => {
    const q = quota();
    q.windows.push({ ...q.windows[0], id: 'code-review-weekly' });
    expect(buildCapacityAccounts([{ name: 'a' }], { a: q })[0].windows).toHaveLength(1);
  });
});

describe('bounded local quota sampling', () => {
  test('cached renders do not invent new samples or writes', () => {
    const accounts = [account('a')];
    const history = recordCapacitySamples({}, accounts, NOW);
    expect(recordCapacitySamples(history, accounts, NOW + 60_000)).toBe(history);
    expect(Object.values(history)[0]).toHaveLength(1);
  });

  test('starts a new segment on reset, usage rollback or long gaps', () => {
    for (const change of ['reset', 'rollback', 'gap']) {
      const a = account('a');
      const w = a.windows[0];
      const sample = { atMs: NOW - HOUR_MS / 2, used: 20, resetAtMs: w.resetAtMs };
      if (change === 'reset') sample.resetAtMs -= HOUR_MS;
      if (change === 'rollback') sample.used = 80;
      if (change === 'gap') sample.atMs = NOW - 2 * HOUR_MS;
      const history = { [capacityHistoryKey(a, w)]: [sample] };
      const next = recordCapacitySamples(history, [a], NOW);
      expect(Object.values(next)[0]).toHaveLength(1);
      expect(estimateCapacity([a], next, NOW)[0].additionalAccounts).toBeNull();
    }
  });

  test('tolerates small reset timestamp jitter without rounding across a bucket boundary', () => {
    const a = account('a');
    const history = historyFor([a], [2]);
    Object.values(history)[0][0].resetAtMs -= 1000;
    expect(estimateCapacity([a], history, NOW)[0].status).toBe('ready');
  });

  test('prunes removed accounts but preserves samples while a quota refresh is loading', () => {
    const accounts = [account('a'), account('b')];
    const history = historyFor(accounts, [2, 2]);
    const next = recordCapacitySamples(
      history,
      [{ ...accounts[0], available: false, windows: [] }],
      NOW
    );
    expect(Object.keys(next)).toHaveLength(1);
    expect(Object.values(next)[0]).toHaveLength(2);
  });

  test('bounds history size even under frequent manual refresh', () => {
    const a = account('a');
    let history: CapacityHistory = {};
    for (let i = 0; i < 400; i++) {
      a.windows[0].atMs = NOW + i * 60_000;
      history = recordCapacitySamples(history, [a], a.windows[0].atMs);
    }
    expect(Object.values(history)[0].length).toBeLessThanOrEqual(96);
  });

  test('separates servers and tolerates corrupt or unavailable localStorage', () => {
    const items = new Map<string, string>();
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => {
        items.set(key, value);
      },
    };
    const history = historyFor([account('a')], [1]);
    writeCapacityHistory('server-a', history, storage);
    expect(readCapacityHistory('server-a', storage, NOW)).toEqual(history);
    expect(readCapacityHistory('server-b', storage, NOW)).toEqual({});
    storage.setItem(capacityStorageKey('server-a'), '{broken');
    expect(readCapacityHistory('server-a', storage, NOW)).toEqual({});
    expect(() =>
      writeCapacityHistory('x', history, {
        setItem() {
          throw new Error('full');
        },
      })
    ).not.toThrow();
    expect(
      readCapacityHistory(
        'x',
        {
          getItem() {
            throw new Error('blocked');
          },
        },
        NOW
      )
    ).toEqual({});
  });

  test('discards expired and future storage samples', () => {
    const sample = account('a').windows[0];
    const storage = {
      getItem: () =>
        JSON.stringify({
          key: [
            { ...sample, atMs: NOW - 7 * HOUR_MS },
            { ...sample, atMs: NOW + 2 * HOUR_MS },
            { ...sample, used: 999 },
            null,
          ],
        }),
    };
    expect(readCapacityHistory('a', storage, NOW)).toEqual({});
  });
});

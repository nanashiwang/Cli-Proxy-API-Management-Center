import { describe, expect, test } from 'bun:test';
import {
  getOpenCodeProviderRecentStatusData,
  getOpenCodeProviderTotalStats,
} from '../src/components/providers/utils';
import type { ProviderRecentUsageMap } from '../src/components/providers/utils';

describe('OpenCode provider usage', () => {
  test('aggregates masked multi-key runtime entries for the provider row', () => {
    const usageByProvider: ProviderRecentUsageMap = new Map([
      [
        'opencode',
        new Map([
          [
            'https://opencode.ai/zen|zen-key',
            { success: 2, failed: 1, recentRequests: [{ success: 2, failed: 1 }] },
          ],
          [
            'https://opencode.ai/zen/go|go-key',
            { success: 3, failed: 0, recentRequests: [{ success: 3, failed: 0 }] },
          ],
        ]),
      ],
    ]);

    expect(getOpenCodeProviderTotalStats(usageByProvider)).toEqual({
      success: 5,
      failure: 1,
    });

    const status = getOpenCodeProviderRecentStatusData(usageByProvider);
    expect(status.totalSuccess).toBe(5);
    expect(status.totalFailure).toBe(1);
  });

  test('returns zero stats when the backend has no OpenCode usage bucket', () => {
    const usageByProvider: ProviderRecentUsageMap = new Map();

    expect(getOpenCodeProviderTotalStats(usageByProvider)).toEqual({
      success: 0,
      failure: 0,
    });
    expect(getOpenCodeProviderRecentStatusData(usageByProvider).totalSuccess).toBe(0);
    expect(getOpenCodeProviderRecentStatusData(usageByProvider).totalFailure).toBe(0);
  });
});

test('aggregates opaque OpenCode identities and uses recent buckets separately from lifetime totals', () => {
  const usage: ProviderRecentUsageMap = new Map([
    [
      'opencode',
      new Map([
        [
          'https://opencode.ai/zen|zen-auth',
          { success: 100, failed: 10, recentRequests: [{ success: 1, failed: 0 }] },
        ],
        [
          'https://opencode.ai/zen/go|go-auth',
          { success: 200, failed: 20, recentRequests: [{ success: 2, failed: 1 }] },
        ],
        [
          'https://opencode.ai/zen|anonymous-auth',
          { success: 1, failed: 0, recentRequests: [{ success: 1, failed: 0 }] },
        ],
      ]),
    ],
  ]);
  expect(getOpenCodeProviderTotalStats(usage)).toEqual({ success: 301, failure: 30 });
  const recent = getOpenCodeProviderRecentStatusData(usage);
  expect(recent.totalSuccess).toBe(4);
  expect(recent.totalFailure).toBe(1);
});

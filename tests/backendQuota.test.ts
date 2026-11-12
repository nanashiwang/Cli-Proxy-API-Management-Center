import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import {
  backendQuotaState,
  readBackendQuota,
  withBackendQuota,
} from '../src/features/quota/backendQuota';
import { buildTimelineLane } from '../src/features/quota/quotaTimelineModel';
import { nextRecoveryMs } from '../src/features/quota/resetSchedule';
import { normalizeAuthFilesResponse } from '../src/services/api/authFiles';
import type { QuotaProviderType } from '../src/features/quota/providers/types';
const t = ((key: string) => key) as TFunction;
const observed = '2026-11-12T03:00:00Z';
const reset = '2026-11-15T03:00:00Z';
const window = {
  name: 'weekly',
  used_percent: 76,
  window_seconds: 604800,
  observed_at: observed,
  reset_at: reset,
};
const file = (provider: QuotaProviderType) => ({
  name: `${provider}.json`,
  type: provider,
  [provider === 'codex' ? 'codex_quota' : 'provider_quota']: {
    windows: [{ ...window, name: provider === 'codex' ? 'secondary' : `${provider}:weekly` }],
    observed_at: observed,
  },
  quota_guard: { state: 'query_failed', next_check_at: reset },
});

describe('backend quota display', () => {
  for (const provider of ['codex', 'claude', 'kimi', 'xai', 'antigravity'] as const) {
    test(`${provider} displays existing list observations without a manual response`, () => {
      const normalized = normalizeAuthFilesResponse({ files: [file(provider)] }).files[0];
      const quota = withBackendQuota(normalized, undefined, t)!;
      expect(quota.status).toBe('success');
      expect(quota.hasManualQuota).toBe(false);
      expect(quota.backendQuota?.windows[0].usedPercent).toBe(76);
      expect(quota.backendQuota?.windows[0].observedAtMs).toBe(Date.parse(observed));
      expect(backendQuotaState(quota.backendQuota!, Date.parse(reset))).toBe('query_failed');
      expect(nextRecoveryMs(provider, quota, Date.parse(observed))).toBe(Date.parse(reset));
      const lane = buildTimelineLane({
        name: normalized.name,
        displayName: normalized.name,
        provider,
        quota,
      });
      expect(lane.provider).toBe(provider);
      expect(lane.remaining).toBe(24);
      expect(lane.anchorMs).toBe(Date.parse(reset));
    });
  }
  test('new lists replace percentages without touching the manual cache', () => {
    const original = file('claude');
    const manual = { status: 'success' as const, error: undefined };
    const newer = {
      ...original,
      provider_quota: {
        windows: [{ ...window, used_percent: 82, observed_at: '2026-11-12T03:01:00Z' }],
      },
    };
    expect(withBackendQuota(original, manual, t)?.backendQuota?.windows[0].usedPercent).toBe(76);
    expect(withBackendQuota(newer, manual, t)?.backendQuota?.windows[0].usedPercent).toBe(82);
    expect('backendQuota' in manual).toBe(false);
    expect(withBackendQuota(newer, manual, t)?.hasManualQuota).toBe(true);
  });
  test('manual failure/loading never hides known windows or resets observation age', () => {
    for (const status of ['loading', 'error'] as const) {
      const quota = withBackendQuota(file('claude'), { status, error: '429' }, t)!;
      expect(quota.status).toBe(status);
      expect(quota.backendQuota?.windows[0].observedAtMs).toBe(Date.parse(observed));
    }
  });
  test('zero is valid, missing percentages and zero dates are unknown', () => {
    const quota = readBackendQuota(
      {
        ...file('claude'),
        provider_quota: {
          windows: [
            { ...window, used_percent: 0, reset_at: '0001-01-01T00:00:00Z' },
            { name: 'bad', window_seconds: 604800 },
          ],
        },
      },
      t
    )!;
    expect(quota.windows).toHaveLength(1);
    expect(quota.windows[0].usedPercent).toBe(0);
    expect(quota.windows[0].resetAtMs).toBeNull();
    expect(
      readBackendQuota(
        { ...file('claude'), provider_quota: { windows: [{ ...window, used_percent: NaN }] } },
        t
      )
    ).toBeUndefined();
    const manual = { status: 'idle' as const };
    expect(withBackendQuota({ name: 'legacy.json' }, manual, t)).toBe(manual);
  });
  test('partial windows keep their original per-window ages; deadline never changes usage', () => {
    const quota = readBackendQuota(
      {
        ...file('claude'),
        provider_quota: {
          request_started_at: '2026-11-12T04:00:00Z',
          windows: [window, { ...window, name: 'other', observed_at: '0001-01-01T00:00:00Z' }],
        },
        quota_guard: { state: 'ready', valid_until: '2026-11-12T04:02:00Z' },
      },
      t
    )!;
    expect(quota.windows[0].observedAtMs).toBe(Date.parse(observed));
    expect(quota.windows[1].observedAtMs).toBe(Date.parse('2026-11-12T04:00:00Z'));
    expect(backendQuotaState(quota, Date.parse(reset))).toBe('stale');
    expect(quota.windows[0].usedPercent).toBe(76);
  });
  test('backend windows preserve explicitly fetched Codex reset credits', () => {
    const creditTime = Date.parse('2026-11-13T03:00:00Z');
    const manual = {
      status: 'success' as const,
      windows: [{ id: 'weekly', usedPercent: 70, resetAtMs: Date.parse(reset), periodHours: 168 }],
      rateLimitResetCredits: [
        { id: 'credit', status: 'available', expiresAt: new Date(creditTime).toISOString() },
      ],
    };
    const quota = withBackendQuota(file('codex'), manual, t)!;
    expect(nextRecoveryMs('codex', quota, Date.parse(observed))).toBe(creditTime);
    expect(
      buildTimelineLane({ name: 'c', displayName: 'c', provider: 'codex', quota }).resetCredits
    ).toHaveLength(1);
  });
  test('Grok monthly billing stays out of the recovery timeline and sorting', () => {
    const quota = withBackendQuota(
      {
        ...file('xai'),
        provider_quota: { windows: [{ ...window, name: 'xai:monthly', window_seconds: 2592000 }] },
      },
      undefined,
      t
    )!;
    expect(quota.backendQuota?.windows).toHaveLength(1);
    expect(nextRecoveryMs('xai', quota, 0)).toBeNull();
    expect(
      buildTimelineLane({ name: 'x', displayName: 'x', provider: 'xai', quota }).anchorMs
    ).toBeNull();
  });
});

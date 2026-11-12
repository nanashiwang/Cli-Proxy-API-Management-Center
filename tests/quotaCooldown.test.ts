import { describe, expect, test } from 'bun:test';
import { quotaRetryAt, quotaWaitUntil } from '../src/features/quota/cooldown';
describe('shared quota retry deadlines', () => {
  test('uses the later server reset or HTTP cooldown', () => {
    const reset = Date.parse('2030-01-01T00:00:00Z');
    const file = {
      name: 'account',
      quota_guard: { state: 'threshold', next_check_at: new Date(reset).toISOString() },
    };
    expect(quotaWaitUntil(file, { nextCheckAt: reset + 1000 })).toBe(reset + 1000);
    expect(quotaWaitUntil(file, { nextCheckAt: reset - 1000 })).toBe(reset);
  });
  test('does not treat a normal scheduled poll as an account failure', () => {
    expect(
      quotaWaitUntil({
        name: 'account',
        quota_guard: { state: 'ready', next_check_at: '2030-01-01T00:00:00Z' },
      })
    ).toBe(0);
  });
  test('reads structured errors and rejects invalid deadlines', () => {
    expect(quotaRetryAt(Object.assign(new Error('429'), { nextCheckAt: 1234 }))).toBe(1234);
    expect(quotaRetryAt({ nextCheckAt: 'invalid' })).toBeUndefined();
    expect(
      quotaWaitUntil({
        name: 'account',
        quota_guard: { state: 'query_failed', next_check_at: 'invalid' },
      })
    ).toBe(0);
  });
});

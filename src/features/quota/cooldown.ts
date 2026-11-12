import type { AuthFileItem } from '@/types';
export function quotaRetryAt(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('nextCheckAt' in error)) return undefined;
  const value = Number(error.nextCheckAt);
  return Number.isFinite(value) ? value : undefined;
}
export function quotaWaitUntil(file: AuthFileItem, quota?: { nextCheckAt?: number }): number {
  const guard = file.quota_guard;
  let server = 0;
  if (
    typeof guard === 'object' &&
    guard !== null &&
    'state' in guard &&
    ['threshold', 'query_failed'].includes(String(guard.state)) &&
    'next_check_at' in guard
  ) {
    const parsed = Date.parse(String(guard.next_check_at));
    if (Number.isFinite(parsed)) server = parsed;
  }
  return Math.max(server, quota?.nextCheckAt ?? 0);
}

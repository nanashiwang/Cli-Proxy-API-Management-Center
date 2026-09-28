import type { ExecutionCapacity } from '@/types/authFile';

export function normalizeExecutionCapacity(raw: unknown): ExecutionCapacity | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const active = value.active;
  const limit = value.limit;
  if (
    value.scope !== 'local' ||
    typeof active !== 'number' ||
    !Number.isSafeInteger(active) ||
    active < 0
  )
    return undefined;
  if (limit !== null && (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit <= 0))
    return undefined;
  if (typeof value.unlimited !== 'boolean' || (value.unlimited && limit !== null)) return undefined;
  if (typeof value.observed_at !== 'string' || !Number.isFinite(Date.parse(value.observed_at)))
    return undefined;
  return {
    active,
    limit: limit as number | null,
    unlimited: value.unlimited,
    scope: 'local',
    observedAt: value.observed_at,
  };
}

export const executionCapacityFull = (capacity?: ExecutionCapacity) =>
  capacity !== undefined && capacity.limit !== null && capacity.active >= capacity.limit;

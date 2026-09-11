import type { AuthFileItem } from '@/types';
import type {
  AccountPoolCredential,
  AccountPoolKey,
  AccountPoolsResponse,
} from '@/services/api/accountPools';
import { ruleFor } from '@/features/accountPools/model';

export function indexPoolCredentials(data: AccountPoolsResponse | null) {
  const byId = new Map<string, AccountPoolCredential>();
  const byName = new Map<string, AccountPoolCredential | null>();
  for (const c of data?.credentials ?? []) {
    byId.set(c.id, c);
    byName.set(c.name, byName.has(c.name) ? null : c);
  }
  return (file: AuthFileItem): AccountPoolCredential | undefined => {
    if (typeof file.id === 'string' && file.id) return byId.get(file.id);
    return byName.get(file.name) ?? undefined;
  };
}

export type PoolKeyAccess =
  'allowed' | 'lease_required' | 'account_disabled' | 'group_disabled' | 'denied' | 'unknown';
export function poolKeyAccess(
  data: AccountPoolsResponse,
  credential: AccountPoolCredential,
  file: AuthFileItem,
  key: AccountPoolKey
): PoolKeyAccess {
  if (file.disabled === true || (file.disabled === undefined && credential.disabled))
    return 'account_disabled';
  if (data['lease-error']) return 'unknown';
  if (!data.config.enabled) return 'allowed';
  const group = data.config.groups.find((g) => g.id === credential['group-id']);
  if (!group) return 'unknown';
  if (group.disabled) return 'group_disabled';
  const rule = ruleFor(data.config, key['key-hash']);
  if (rule.scope !== 'all' && !rule['group-ids'].includes(group.id)) return 'denied';
  if (rule['lease-instance']) return group.lease ? 'lease_required' : 'denied';
  return group.lease ? 'denied' : 'allowed';
}

export function poolLeaseState(
  data: AccountPoolsResponse,
  groupId: string,
  now: number
): 'ordinary' | 'off' | 'free' | 'occupied' | 'draining' | 'unknown' {
  const group = data.config.groups.find((g) => g.id === groupId);
  if (!group || data['lease-error']) return 'unknown';
  if (!data.config.enabled) return 'off';
  if (!group.lease) return 'ordinary';
  const lease = data.leases?.find((l) => l['group-id'] === groupId);
  if (data.leases === undefined) return 'unknown';
  if (!lease) return 'free';
  const expires = Date.parse(lease['expires-at']);
  if (!Number.isFinite(expires)) return 'unknown';
  // Do not infer that an expired lease is free from a stale browser snapshot.
  return expires <= now ? (lease.active > 0 ? 'draining' : 'unknown') : 'occupied';
}

export function poolKeyConfigured(
  data: AccountPoolsResponse,
  credential: AccountPoolCredential,
  key: AccountPoolKey
): boolean {
  const group = data.config.groups.find((g) => g.id === credential['group-id']);
  if (!group) return false;
  const rule = ruleFor(data.config, key['key-hash']);
  return (
    (rule.scope === 'all' || rule['group-ids'].includes(group.id)) &&
    (rule['lease-instance'] ? group.lease === true : !group.lease)
  );
}

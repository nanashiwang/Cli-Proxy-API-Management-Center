import type { AuthFileItem } from '@/types';
import type { UsageAccountSummary } from '@/types/usage';
import { normalizeAuthIndex } from '@/utils/authIndex';

export interface QuotaUsageCost {
  totalUsd: number;
  totalRequests: number;
  estimated: boolean;
  cacheWriteUnreported: boolean;
}

export const buildAccountUsageByAuthIndex = (
  accounts: UsageAccountSummary[]
): Map<string, UsageAccountSummary> => {
  const result = new Map<string, UsageAccountSummary>();
  accounts.forEach((account) => {
    const authIndex = normalizeAuthIndex(account.auth_index);
    if (authIndex) result.set(authIndex, account);
  });
  return result;
};

export const resolveQuotaUsageCost = (
  file: AuthFileItem,
  usageByAuthIndex: ReadonlyMap<string, UsageAccountSummary>,
  storageEnabled: boolean
): QuotaUsageCost | undefined => {
  if (!storageEnabled) return undefined;
  const authIndex = normalizeAuthIndex(file['auth_index'] ?? file.authIndex);
  if (!authIndex) return undefined;

  const usage = usageByAuthIndex.get(authIndex);
  return {
    totalUsd: usage?.total_cost_usd ?? 0,
    totalRequests: usage?.total_requests ?? 0,
    estimated: usage?.estimated ?? false,
    cacheWriteUnreported: usage?.cache_write_unreported ?? false,
  };
};

import { apiClient } from './client';
import type {
  ModelPricingStatus,
  ModelPricingSummary,
  UsageAccountRangeInput,
  UsageAccountRangesResponse,
  UsageAccountSummaryResponse,
  UsageRange,
  UsageResponse,
} from '@/types/usage';

export interface ModelPricingListResponse {
  count: number;
  models: ModelPricingSummary[];
}

export interface PricingOverrideInput {
  provider?: string;
  input?: number;
  output?: number;
  'cache-read'?: number;
  'cache-write'?: number;
}

export const usageApi = {
  getUsage: (from?: string, to?: string, range?: UsageRange) =>
    apiClient.get<UsageResponse>('/usage', {
      params: {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(range ? { range, details_limit: 50 } : {}),
      },
      timeout: range ? 15_000 : 60_000,
    }),
  getAccountUsage: (from?: string, to?: string) =>
    apiClient.get<UsageAccountSummaryResponse>('/usage/accounts', {
      params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
      timeout: 60_000,
    }),
  getAccountUsageRanges: (ranges: UsageAccountRangeInput[]) =>
    apiClient.post<UsageAccountRangesResponse>(
      '/usage/accounts/ranges',
      { ranges },
      {
        timeout: 60_000,
      }
    ),
  exportUsage: () => apiClient.get<Record<string, unknown>>('/usage/export', { timeout: 60_000 }),
  importUsage: (payload: unknown) =>
    apiClient.post<Record<string, unknown>>('/usage/import', payload, { timeout: 60_000 }),
  clearUsage: () => apiClient.delete<{ status: string }>('/usage', { timeout: 60_000 }),
  getPricingStatus: () => apiClient.get<ModelPricingStatus>('/model-pricing/status'),
  refreshPricing: () =>
    apiClient.post<{ status: ModelPricingStatus }>('/model-pricing/refresh', undefined, {
      timeout: 60_000,
    }),
  listPricing: (query = '', limit = 100) =>
    apiClient.get<ModelPricingListResponse>('/model-pricing', {
      params: { q: query || undefined, limit },
    }),
  putCustomPricing: (model: string, payload: PricingOverrideInput) =>
    apiClient.put(`/model-pricing/custom/${encodeURIComponent(model)}`, payload),
  deleteCustomPricing: (model: string) =>
    apiClient.delete(`/model-pricing/custom/${encodeURIComponent(model)}`),
};

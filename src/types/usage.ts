export interface UsageTokenStats {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
}

export interface UsageBilling {
  currency: string;
  priced: boolean;
  reason?: string;
  total_usd: number;
  breakdown: {
    input_usd: number;
    output_usd: number;
    cache_read_usd: number;
    cache_write_usd: number;
  };
  pricing: {
    version: string;
    source: string;
    matched_model: string;
    matched_provider?: string;
    service_tier: string;
    estimated: boolean;
    calculated_at: string;
  };
}

export interface UsageRequestDetail {
  timestamp: string;
  latency_ms: number;
  ttft_ms: number;
  provider: string;
  executor_type: string;
  alias: string;
  endpoint: string;
  source: string;
  auth_id: string;
  auth_index: string;
  auth_type: string;
  request_id?: string;
  service_tier: string;
  response_service_tier?: string;
  tokens: UsageTokenStats;
  failed: boolean;
  status_code: number;
  generate: boolean;
  billing: UsageBilling;
  cost_usd?: number;
}

export interface UsageDimensionSnapshot {
  total_requests: number;
  success_count: number;
  failure_count: number;
  priced_requests: number;
  unpriced_requests: number;
  total_tokens: number;
  tokens: UsageTokenStats;
  total_cost_usd: number;
}

export interface UsageModelSnapshot {
  total_requests: number;
  total_tokens: number;
  total_cost_usd: number;
  details: UsageRequestDetail[];
}

export interface UsageAPISnapshot {
  total_requests: number;
  total_tokens: number;
  total_cost_usd: number;
  models: Record<string, UsageModelSnapshot>;
}

export type UsageRange = '24h' | '7d' | '30d' | 'all';

export interface UsageSnapshot {
  total_requests: number;
  success_count: number;
  failure_count: number;
  priced_requests: number;
  unpriced_requests: number;
  total_tokens: number;
  estimated?: boolean;
  cache_write_unreported?: boolean;
  tokens: UsageTokenStats;
  total_cost_usd: number;
  apis: Record<string, UsageAPISnapshot>;
  accounts: Record<string, UsageDimensionSnapshot>;
  providers: Record<string, UsageDimensionSnapshot>;
  models: Record<string, UsageDimensionSnapshot>;
  requests_by_day: Record<string, number>;
  requests_by_hour: Record<string, number>;
  requests_by_hour_window?: Record<string, number>;
  tokens_by_day: Record<string, number>;
  tokens_by_hour: Record<string, number>;
  tokens_by_hour_window?: Record<string, number>;
  cost_by_day: Record<string, number>;
  cost_by_hour: Record<string, number>;
  cost_by_hour_window?: Record<string, number>;
}

export interface UsageStorageStatus {
  enabled: boolean;
  storage_path?: string;
  retention_days: number;
  max_records: number;
  record_count: number;
  file_size_bytes: number;
  oldest_at?: string;
  latest_at?: string;
  loaded_at?: string;
  last_error?: string;
}

export interface UsageCacheStatus {
  window: UsageRange;
  precomputed: boolean;
  computed_at?: string;
  age_seconds: number;
}

export interface UsageResponse {
  usage: UsageSnapshot;
  failed_requests: number;
  storage: UsageStorageStatus;
  cache?: UsageCacheStatus;
}

export interface UsageAccountSummary extends UsageDimensionSnapshot {
  key: string;
  auth_index?: string;
  auth_id?: string;
  source?: string;
  provider: string;
  estimated: boolean;
  cache_write_unreported: boolean;
}

export interface UsageAccountSummaryResponse {
  accounts: UsageAccountSummary[];
  storage: UsageStorageStatus;
}

export interface UsageAccountRangeInput {
  key: string;
  auth_index: string;
  from: string;
  to: string;
}

export interface UsageAccountRangeSummary extends UsageDimensionSnapshot {
  key: string;
  auth_index: string;
  from: string;
  to: string;
  estimated: boolean;
  cache_write_unreported: boolean;
}

export interface UsageAccountRangesResponse {
  ranges: UsageAccountRangeSummary[];
  storage: UsageStorageStatus;
}

export interface ModelPricingStatus {
  enabled: boolean;
  source_url: string;
  active_source: string;
  version: string;
  model_count: number;
  updated_at: string;
  last_refresh_attempt?: string;
  last_error?: string;
  refresh_interval: string;
  cache_path?: string;
  custom_model_count: number;
}

export interface ModelPricingSummary {
  model: string;
  provider?: string;
  input_usd_per_million_tokens: number;
  output_usd_per_million_tokens: number;
  cache_read_usd_per_million_tokens: number;
  cache_write_usd_per_million_tokens: number;
  custom_override: boolean;
}

/** Server-side analytics contract. Rates are fractions in [0, 1]. */
export interface UsageFilters {
  range?: UsageRange;
  from?: string;
  to?: string;
  provider?: string;
  model?: string;
  account?: string;
  api_key?: string;
  pool?: string;
  status?: 'success' | 'failed';
  status_code?: number;
  search?: string;
  include_warmup?: boolean;
}
export type UsageSort = 'timestamp' | 'latency' | 'ttft' | 'tokens' | 'cost';
export interface UsageRecordsQuery extends UsageFilters {
  page: number;
  page_size: number;
  sort?: UsageSort;
  order?: 'asc' | 'desc';
}
export interface UsageRecord extends UsageRequestDetail {
  id: string;
  model: string;
  api: string;
  account: string;
  token_breakdown?: {
    quality: 'complete' | 'inconsistent' | 'unclassified';
    schema_version: number;
    total_tokens: number;
    unclassified_tokens: number;
    input: {
      total_tokens: number;
      uncached_tokens: number;
      cache_read_tokens: number;
      cache_write_tokens: number;
    };
    output: { total_tokens: number; non_reasoning_tokens: number; reasoning_tokens: number };
  };
}
export interface UsageRecordsResponse {
  items: UsageRecord[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
export interface UsageSummary extends UsageDimensionSnapshot {
  avg_latency_ms: number | null;
  avg_ttft_ms: number | null;
  estimated: boolean;
  cache_write_unreported: boolean;
  token_quality: {
    complete: number;
    inconsistent: number;
    unclassified: number;
    unavailable: number;
  };
}
export interface UsagePerformance {
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  latency_p99_ms: number | null;
  ttft_p50_ms: number | null;
  ttft_p95_ms: number | null;
  ttft_p99_ms: number | null;
  latency_samples: number;
  ttft_samples: number;
  latency_coverage: number;
  ttft_coverage: number;
  output_tokens_per_second: number | null;
  throughput_samples: number;
}
export interface UsageHealth {
  success_rate: number;
  status_codes: Record<string, number>;
  client_error_count: number;
  server_error_count: number;
  rate_limited_count: number;
}
export interface UsageCost {
  total_cost_usd: number | null;
  avg_cost_usd: number | null;
  pricing_coverage: number;
  cache_read_ratio: number;
  cache_hit_request_ratio: number;
  priced_requests: number;
  unpriced_requests: number;
  breakdown: {
    input_usd: number;
    output_usd: number;
    cache_read_usd: number;
    cache_write_usd: number;
  };
}
export interface UsageTrend extends UsageDimensionSnapshot {
  known_cost_usd: number | null;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  latency_p99_ms: number | null;
  ttft_p50_ms: number | null;
  ttft_p95_ms: number | null;
  ttft_p99_ms: number | null;
  timestamp: string;
  avg_latency_ms: number | null;
  avg_ttft_ms: number | null;
}
export interface UsageDimension extends UsageDimensionSnapshot {
  key: string;
  label: string;
  avg_latency_ms: number | null;
  avg_ttft_ms: number | null;
  error_rate: number;
}
export interface UsageOption {
  value: string;
  label: string;
}
export interface UsageDashboard {
  summary: UsageSummary;
  performance: UsagePerformance;
  health: UsageHealth;
  cost: UsageCost;
  trend: UsageTrend[];
  dimensions: { models: UsageDimension[]; providers: UsageDimension[]; accounts: UsageDimension[] };
  filters: {
    providers: UsageOption[];
    models: UsageOption[];
    accounts: UsageOption[];
    api_keys: UsageOption[];
    pools: UsageOption[];
  };
  storage: UsageStorageStatus;
  granularity: 'hour' | 'day';
  from: string;
  to: string;
}

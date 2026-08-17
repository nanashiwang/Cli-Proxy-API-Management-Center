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

export interface UsageSnapshot {
  total_requests: number;
  success_count: number;
  failure_count: number;
  priced_requests: number;
  unpriced_requests: number;
  total_tokens: number;
  tokens: UsageTokenStats;
  total_cost_usd: number;
  apis: Record<string, UsageAPISnapshot>;
  accounts: Record<string, UsageDimensionSnapshot>;
  providers: Record<string, UsageDimensionSnapshot>;
  models: Record<string, UsageDimensionSnapshot>;
  requests_by_day: Record<string, number>;
  requests_by_hour: Record<string, number>;
  tokens_by_day: Record<string, number>;
  tokens_by_hour: Record<string, number>;
  cost_by_day: Record<string, number>;
  cost_by_hour: Record<string, number>;
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

export interface UsageResponse {
  usage: UsageSnapshot;
  failed_requests: number;
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

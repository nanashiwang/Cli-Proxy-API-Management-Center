/** Transport is a captured fact; neither endpoints nor provider names establish it. */
export function usageTransportLabel(value: unknown): string | null {
  switch (value) {
    case 'http':
      return 'HTTP';
    case 'sse':
      return 'SSE';
    case 'ws':
      return 'WS';
    default:
      return null;
  }
}

export function usageRecordedText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export const USAGE_RECORD_COLUMNS = [
  'account',
  'provider_type',
  'model',
  'reasoning_effort',
  'endpoint',
  'upstream_transport',
  'client_transport',
  'tokens',
  'cost',
  'request_latency',
  'time',
  'client_ip',
  'user_agent',
  'actions',
] as const;

export type UsageRecordColumn = (typeof USAGE_RECORD_COLUMNS)[number];
export const USAGE_RECORD_COLUMN_WIDTHS: Record<UsageRecordColumn, number> = {
  account: 180,
  provider_type: 110,
  model: 220,
  reasoning_effort: 96,
  endpoint: 180,
  upstream_transport: 82,
  client_transport: 82,
  tokens: 230,
  cost: 160,
  request_latency: 132,
  time: 112,
  client_ip: 170,
  user_agent: 250,
  actions: 100,
};

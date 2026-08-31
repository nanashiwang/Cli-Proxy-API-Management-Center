/** 原生 OpenCode Zen/Go 管理 API。 */

import { apiClient } from './client';
import type { OpenCodeConfig, OpenCodeKeyConfig, OpenCodeTierConfig } from '@/types';
import { isRecord } from '@/utils/helpers';

export const OPENCODE_ZEN_URL = 'https://opencode.ai/zen';
export const OPENCODE_GO_URL = 'https://opencode.ai/zen/go';

const numberOrUndefined = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeHeaders = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined;
  const headers: Record<string, string> = {};
  Object.entries(value).forEach(([key, item]) => {
    const normalizedKey = key.trim();
    const normalizedValue = String(item ?? '').trim();
    if (normalizedKey && normalizedValue) headers[normalizedKey] = normalizedValue;
  });
  return Object.keys(headers).length ? headers : undefined;
};

const normalizeKey = (value: unknown): OpenCodeKeyConfig | null => {
  if (!isRecord(value)) return null;
  const apiKey = String(value['api-key'] ?? '').trim();
  const apiKeyConfigured = value['api-key-configured'] === true || Boolean(apiKey);
  if (!apiKey && !apiKeyConfigured) return null;
  const key: OpenCodeKeyConfig = { apiKey };
  if (!apiKey && apiKeyConfigured) key.apiKeyConfigured = true;
  if (typeof value['api-key-preview'] === 'string' && value['api-key-preview'].trim()) {
    key.apiKeyPreview = value['api-key-preview'].trim();
  }
  const sourceIndex = numberOrUndefined(value['source-index']);
  if (sourceIndex !== undefined && Number.isInteger(sourceIndex) && sourceIndex >= 0) {
    key.sourceIndex = sourceIndex;
  }
  const priority = numberOrUndefined(value.priority);
  const weight = numberOrUndefined(value.weight);
  const requestRetry = numberOrUndefined(value['request-retry']);
  if (priority !== undefined) key.priority = priority;
  if (weight !== undefined) key.weight = weight;
  if (requestRetry !== undefined) key.requestRetry = requestRetry;
  if (typeof value['proxy-url'] === 'string' && value['proxy-url'].trim()) {
    key.proxyUrl = value['proxy-url'].trim();
  }
  if (typeof value['disable-cooling'] === 'boolean') {
    key.disableCooling = value['disable-cooling'];
  }
  const headers = normalizeHeaders(value.headers);
  if (headers) key.headers = headers;
  if (Array.isArray(value['request-scoped-errors'])) {
    key.requestScopedErrors = value['request-scoped-errors'].filter(isRecord);
  }
  return key;
};

const normalizeTier = (value: unknown, fallbackUrl: string): OpenCodeTierConfig => {
  const record = isRecord(value) ? value : {};
  const keys = Array.isArray(record['api-key-entries'])
    ? (record['api-key-entries'].map(normalizeKey).filter(Boolean) as OpenCodeKeyConfig[])
    : [];
  return {
    baseUrl:
      typeof record['base-url'] === 'string' && record['base-url'].trim()
        ? record['base-url'].trim()
        : fallbackUrl,
    apiKeyEntries: keys,
    headers: normalizeHeaders(record.headers),
  };
};

export const normalizeOpenCodeConfig = (value: unknown): OpenCodeConfig => {
  const outer = isRecord(value) ? value : {};
  const record = isRecord(outer.opencode) ? outer.opencode : outer;
  const prefer = record.prefer === 'zen' ? 'zen' : 'go';
  const refreshSeconds = numberOrUndefined(record['refresh-seconds']);
  const protocolOverrides = isRecord(record['protocol-overrides'])
    ? Object.fromEntries(
        Object.entries(record['protocol-overrides']).map(([key, item]) => [key, String(item)])
      )
    : undefined;
  return {
    enabled: record.enabled === true,
    prefer,
    anonymous: record.anonymous === true,
    refreshSeconds: refreshSeconds ?? 300,
    zen: normalizeTier(record.zen, OPENCODE_ZEN_URL),
    go: normalizeTier(record.go, OPENCODE_GO_URL),
    protocolOverrides,
  };
};

const serializeHeaders = (value: Record<string, string> | undefined) =>
  value && Object.keys(value).length ? value : undefined;

const serializeKey = (key: OpenCodeKeyConfig) => {
  const apiKey = key.apiKey.trim();
  const result: Record<string, unknown> = {
    'api-key': apiKey,
    'api-key-configured': apiKey ? undefined : key.apiKeyConfigured,
    'api-key-preview': apiKey ? undefined : key.apiKeyPreview,
    'source-index': key.sourceIndex,
    priority: key.priority,
    weight: key.weight,
    'proxy-url': key.proxyUrl?.trim() || undefined,
    headers: serializeHeaders(key.headers),
    'disable-cooling': key.disableCooling,
    'request-retry': key.requestRetry,
    'request-scoped-errors': key.requestScopedErrors?.length ? key.requestScopedErrors : undefined,
  };
  return Object.fromEntries(Object.entries(result).filter(([, item]) => item !== undefined));
};

const serializeTier = (tier: OpenCodeTierConfig) => ({
  'base-url': tier.baseUrl,
  'api-key-entries': tier.apiKeyEntries.map(serializeKey).filter((key) => key['api-key'] || key['api-key-configured']),
  headers: serializeHeaders(tier.headers),
});

export const serializeOpenCodeConfig = (config: OpenCodeConfig) => ({
  enabled: config.enabled,
  prefer: config.prefer,
  anonymous: config.anonymous,
  'refresh-seconds': config.refreshSeconds,
  zen: serializeTier(config.zen),
  go: serializeTier(config.go),
  'protocol-overrides':
    config.protocolOverrides && Object.keys(config.protocolOverrides).length
      ? config.protocolOverrides
      : undefined,
});

export const opencodeApi = {
  async getConfig(): Promise<OpenCodeConfig> {
    const data = await apiClient.get('/opencode');
    return normalizeOpenCodeConfig(data);
  },

  async saveConfig(config: OpenCodeConfig): Promise<void> {
    await apiClient.put('/opencode', { opencode: serializeOpenCodeConfig(config) });
  },

  async deleteConfig(): Promise<void> {
    await apiClient.put('/opencode', {
      opencode: {
        enabled: false,
        prefer: 'go',
        anonymous: false,
        'refresh-seconds': 300,
        zen: { 'base-url': OPENCODE_ZEN_URL, 'api-key-entries': [] },
        go: { 'base-url': OPENCODE_GO_URL, 'api-key-entries': [] },
      },
    });
  },
};

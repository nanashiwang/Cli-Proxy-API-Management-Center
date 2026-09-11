/**
 * AI 提供商相关类型
 * 基于原项目 src/modules/ai-providers.js
 */

export interface ModelAlias {
  name: string;
  alias?: string;
  priority?: number;
  testModel?: string;
  image?: boolean;
  thinking?: Record<string, unknown>;
}

export interface ApiKeyEntry {
  apiKey: string;
  proxyUrl?: string;
  weight?: number;
  authIndex?: string;
}

export interface CloakConfig {
  mode?: string;
  strictMode?: boolean;
  sensitiveWords?: string[];
  cacheUserId?: boolean;
}

export interface GeminiKeyConfig {
  apiKey: string;
  priority?: number;
  weight?: number;
  prefix?: string;
  baseUrl?: string;
  proxyUrl?: string;
  models?: ModelAlias[];
  headers?: Record<string, string>;
  excludedModels?: string[];
  disableCooling?: boolean;
  authIndex?: string;
}

export interface ProviderKeyConfig {
  apiKey: string;
  priority?: number;
  weight?: number;
  prefix?: string;
  baseUrl?: string;
  websockets?: boolean;
  proxyUrl?: string;
  headers?: Record<string, string>;
  models?: ModelAlias[];
  excludedModels?: string[];
  disableCooling?: boolean;
  cloak?: CloakConfig;
  fingerprintProfile?: string;
  authIndex?: string;
}

export interface OpenAIProviderConfig {
  name: string;
  prefix?: string;
  baseUrl: string;
  apiKeyEntries: ApiKeyEntry[];
  disabled?: boolean;
  headers?: Record<string, string>;
  models?: ModelAlias[];
  priority?: number;
  testModel?: string;
  disableCooling?: boolean;
  authIndex?: string;
  /** Original index in the backend openai-compatibility array. */
  sourceIndex?: number;
  [key: string]: unknown;
}

export interface OpenCodeKeyConfig {
  apiKey: string;
  /** Optional operator-facing label for the account or purpose of this key. */
  note?: string;
  /** Returned by the management API when the real credential is hidden. */
  apiKeyConfigured?: boolean;
  apiKeyPreview?: string;
  apiKeyRevision?: string;
  sourceIndex?: number;
  priority?: number;
  weight?: number;
  proxyUrl?: string;
  headers?: Record<string, string>;
  disableCooling?: boolean;
  requestRetry?: number;
  requestScopedErrors?: Array<Record<string, unknown>>;
}

export interface OpenCodeTierConfig {
  baseUrl: string;
  apiKeyEntries: OpenCodeKeyConfig[];
  headers?: Record<string, string>;
}

export interface OpenCodeConfig {
  enabled: boolean;
  prefer?: 'zen' | 'go';
  anonymous?: boolean;
  refreshSeconds?: number;
  zen: OpenCodeTierConfig;
  go: OpenCodeTierConfig;
  protocolOverrides?: Record<string, string>;
}

export interface OpenCodeKeyFormInput {
  apiKey: string;
  note: string;
  existingApiKey?: string;
  existingApiKeyConfigured?: boolean;
  existingApiKeyPreview?: string;
  sourceIndex?: number;
  priority?: number;
  weight?: number;
  proxyUrl: string;
  existingConfig?: OpenCodeKeyConfig;
}

export interface OpenCodeFormInput {
  enabled: boolean;
  prefer: 'zen' | 'go';
  anonymous: boolean;
  refreshSeconds: number;
  zen: {
    keys: OpenCodeKeyFormInput[];
    headersJson: string;
  };
  go: {
    keys: OpenCodeKeyFormInput[];
    headersJson: string;
  };
  protocolOverridesJson: string;
}

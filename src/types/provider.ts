export type ProviderPolicyField = 'disable-cooling' | 'request-retry' | 'request-scoped-errors';

export interface RequestScopedErrorRule {
  status?: number;
  match?: string[];
  matchRegex?: string[];
  action?: 'stop' | 'stop-and-cooldown' | 'continue' | 'continue-and-cooldown';
}

export interface ProviderBehaviorOptions {
  alphaSearch?: boolean;
  disableCodexCloaking?: boolean;
  rebuildMidSystemMessage?: boolean;
  supportPromptCacheKey?: boolean;
}

export interface ProviderRuntimePolicy {
  requestRetry?: number;
  requestScopedErrors?: RequestScopedErrorRule[];
  /** Explicit form intent: remove the local override, preserving an untouched null. */
  inheritFields?: ProviderPolicyField[];
}

/** Persisted v8 identity. Never derive a group from its endpoint or credential. */
export interface ProviderSource {
  groups?: unknown[];
  groupIndex: number;
  keyIndex?: number;
  group: Record<string, unknown>;
}

/**
 * AI 提供商相关类型
 * 基于原项目 src/modules/ai-providers.js
 */

export interface ModelAlias {
  /** Persisted model position; null marks a new form row. Never sent to the backend. */
  sourceIndex?: number | null;
  name: string;
  alias?: string;
  priority?: number;
  image?: boolean;
  displayName?: string;
  maxContextLength?: number;
  forceMapping?: boolean;
  isCompat?: boolean;
  supportConfigurationUpdate?: boolean;
  inputModalities?: string[];
  outputModalities?: string[];
  useMaxCompletionTokens?: boolean;
  thinking?: Record<string, unknown>;
}

export interface ApiKeyEntry {
  id?: string;
  note?: string;
  sourceIndex?: number;
  apiKey: string;
  proxyUrl?: string;
  weight?: number;
  authIndex?: string;
}

export interface CloakConfig {
  mode?: string;
  strictMode?: boolean;
  sensitiveWords?: string[];
  sensitiveWordsReplace?: Record<string, string>;
  sensitivePatternsReplace?: { pattern: string; replacement: string }[];
  cacheUserId?: boolean;
}

export interface GeminiKeyConfig extends ProviderRuntimePolicy {
  source?: ProviderSource;
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

export interface ProviderKeyConfig extends ProviderRuntimePolicy, ProviderBehaviorOptions {
  source?: ProviderSource;
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

export interface OpenAIProviderConfig extends ProviderRuntimePolicy, ProviderBehaviorOptions {
  source?: ProviderSource;
  id?: string;
  name: string;
  testModel?: string;
  prefix?: string;
  baseUrl: string;
  apiKeyEntries: ApiKeyEntry[];
  disabled?: boolean;
  headers?: Record<string, string>;
  models?: ModelAlias[];
  priority?: number;
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

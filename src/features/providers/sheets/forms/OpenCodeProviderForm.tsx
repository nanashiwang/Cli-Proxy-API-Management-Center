import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconX } from '@/components/ui/icons';
import { maskApiKey } from '@/utils/format';
import { OPENCODE_GO_URL, OPENCODE_ZEN_URL } from '@/services/api/opencode';
import type {
  OpenCodeConfig,
  OpenCodeFormInput,
  OpenCodeKeyConfig,
  OpenCodeKeyFormInput,
  OpenCodeTierConfig,
} from '@/types';
import type { ProviderEntryFormInput, ProviderResource } from '../../types';
import styles from './sharedForm.module.scss';

interface OpenCodeProviderFormProps {
  resource: ProviderResource | null;
  mode: 'create' | 'edit';
  mutating: boolean;
  formId: string;
  onSubmit: (input: ProviderEntryFormInput) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

const emptyKey = (): OpenCodeKeyFormInput => ({
  apiKey: '',
  proxyUrl: '',
  priority: undefined,
  weight: undefined,
});

const keysFromTier = (tier: OpenCodeTierConfig): OpenCodeKeyFormInput[] =>
  tier.apiKeyEntries.length
    ? tier.apiKeyEntries.map((entry, index) => ({
        apiKey: '',
        existingApiKey: entry.apiKey || undefined,
        existingApiKeyConfigured: entry.apiKeyConfigured ?? Boolean(entry.apiKey),
        existingApiKeyPreview: entry.apiKeyPreview,
        sourceIndex: entry.sourceIndex ?? index,
        priority: entry.priority,
        weight: entry.weight,
        proxyUrl: entry.proxyUrl ?? '',
        existingConfig: entry,
      }))
    : [emptyKey()];

const headersText = (headers?: Record<string, string>): string =>
  headers && Object.keys(headers).length ? JSON.stringify(headers, null, 2) : '';

const buildInitialForm = (
  resource: ProviderResource | null,
  mode: 'create' | 'edit'
): OpenCodeFormInput => {
  const current = mode === 'edit' && resource ? (resource.raw as OpenCodeConfig) : null;
  return {
    enabled: current?.enabled ?? false,
    prefer: current?.prefer === 'zen' ? 'zen' : 'go',
    anonymous: current?.anonymous === true,
    refreshSeconds: current?.refreshSeconds ?? 300,
    zen: {
      keys: keysFromTier(current?.zen ?? { baseUrl: OPENCODE_ZEN_URL, apiKeyEntries: [] }),
      headersJson: headersText(current?.zen?.headers),
    },
    go: {
      keys: keysFromTier(current?.go ?? { baseUrl: OPENCODE_GO_URL, apiKeyEntries: [] }),
      headersJson: headersText(current?.go?.headers),
    },
    protocolOverridesJson: current?.protocolOverrides
      ? JSON.stringify(current.protocolOverrides, null, 2)
      : '',
  };
};

const effectiveKey = (entry: OpenCodeKeyFormInput): string =>
  entry.apiKey.trim() ||
  entry.existingApiKey?.trim() ||
  (entry.existingApiKeyConfigured ? '__configured__' : '');

const parseObjectJson = (value: string, label: string): Record<string, unknown> | undefined => {
  const text = value.trim();
  if (!text) return undefined;
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
};

const parseStringMapJson = (value: string, label: string): Record<string, string> | undefined => {
  const parsed = parseObjectJson(value, label);
  if (!parsed) return undefined;
  const result: Record<string, string> = {};
  Object.entries(parsed).forEach(([key, item]) => {
    if (typeof item !== 'string') throw new Error(`${label} values must be strings`);
    if (key.trim()) result[key.trim()] = item;
  });
  return Object.keys(result).length ? result : undefined;
};

const buildTier = (
  tier: OpenCodeFormInput['zen'],
  baseUrl: string,
  label: string
): OpenCodeTierConfig => {
  const headers = parseStringMapJson(tier.headersJson, `${label} headers`);
  const keyEntries = tier.keys
    .map((entry) => {
      const enteredApiKey = entry.apiKey.trim();
      if (!effectiveKey(entry)) return null;
      const existing = entry.existingConfig ?? ({} as OpenCodeKeyConfig);
      return {
        ...existing,
        apiKey: enteredApiKey || entry.existingApiKey?.trim() || '',
        apiKeyConfigured:
          enteredApiKey || entry.existingApiKey?.trim()
            ? true
            : entry.existingApiKeyConfigured || undefined,
        sourceIndex: entry.sourceIndex,
        priority: entry.priority,
        weight: entry.weight,
        proxyUrl: entry.proxyUrl.trim() || undefined,
      } satisfies OpenCodeKeyConfig;
    })
    .filter(Boolean) as OpenCodeKeyConfig[];
  return {
    baseUrl,
    apiKeyEntries: keyEntries,
    headers,
  };
};

export function OpenCodeProviderForm({
  resource,
  mode,
  mutating,
  formId,
  onSubmit,
  onDirtyChange,
}: OpenCodeProviderFormProps) {
  const { t } = useTranslation();
  const initial = useMemo(() => buildInitialForm(resource, mode), [mode, resource]);
  const [form, setForm] = useState<OpenCodeFormInput>(initial);
  const [error, setError] = useState('');
  const initialSerialized = useRef(JSON.stringify(initial));

  useEffect(() => {
    setForm(initial);
    setError('');
    initialSerialized.current = JSON.stringify(initial);
  }, [initial]);

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(form) !== initialSerialized.current);
  }, [form, onDirtyChange]);

  const update = <K extends keyof OpenCodeFormInput>(field: K, value: OpenCodeFormInput[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateTier = (
    tier: 'zen' | 'go',
    updater: (current: OpenCodeFormInput[typeof tier]) => OpenCodeFormInput[typeof tier]
  ) => {
    setForm((current) => ({ ...current, [tier]: updater(current[tier]) }));
  };

  const updateKey = (tier: 'zen' | 'go', index: number, patch: Partial<OpenCodeKeyFormInput>) => {
    updateTier(tier, (current) => ({
      ...current,
      keys: current.keys.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry
      ),
    }));
  };

  const addKey = (tier: 'zen' | 'go') =>
    updateTier(tier, (current) => ({ ...current, keys: [...current.keys, emptyKey()] }));

  const removeKey = (tier: 'zen' | 'go', index: number) =>
    updateTier(tier, (current) => {
      const keys = current.keys.filter((_, entryIndex) => entryIndex !== index);
      return { ...current, keys: keys.length ? keys : [emptyKey()] };
    });

  const submit = async () => {
    setError('');
    try {
      const zenKeys = form.zen.keys.filter((entry) => effectiveKey(entry));
      const goKeys = form.go.keys.filter((entry) => effectiveKey(entry));
      if (form.enabled && !form.anonymous && zenKeys.length + goKeys.length === 0) {
        throw new Error(t('providersPage.openCode.validation.credentials'));
      }
      const protocolOverrides = parseStringMapJson(
        form.protocolOverridesJson,
        t('providersPage.openCode.protocolOverrides')
      );
      const next: OpenCodeConfig = {
        enabled: form.enabled,
        prefer: form.prefer,
        anonymous: form.anonymous,
        refreshSeconds: Math.min(86400, Math.max(1, Number(form.refreshSeconds) || 300)),
        zen: buildTier(form.zen, OPENCODE_ZEN_URL, t('providersPage.openCode.zen')),
        go: buildTier(form.go, OPENCODE_GO_URL, t('providersPage.openCode.go')),
        protocolOverrides,
      };
      await onSubmit({
        apiKey: '',
        name: '',
        baseUrl: '',
        proxyUrl: '',
        prefix: '',
        disabled: !next.enabled,
        models: [],
        headers: [],
        excludedModelsText: '',
        openCode: next,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const renderTier = (tier: 'zen' | 'go', title: string, url: string) => {
    const value = form[tier];
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <p className={styles.sectionDesc}>{t('providersPage.openCode.tierHint')}</p>
        <div className={styles.field}>
          <label className={styles.label}>{t('providersPage.form.baseUrl')}</label>
          <input className={styles.input} value={url} readOnly disabled={mutating} />
        </div>
        {value.keys.map((entry, index) => (
          <div className={styles.entryCard} key={`${tier}-${index}`}>
            <div className={styles.entryCardHeader}>
              <span>{t('providersPage.openCode.keyEntry', { index: index + 1 })}</span>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeKey(tier, index)}
                disabled={
                  mutating ||
                  (value.keys.length <= 1 &&
                    !entry.existingApiKey &&
                    !entry.existingApiKeyConfigured)
                }
              >
                <IconX size={14} />
              </button>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{t('providersPage.form.apiKey')}</label>
              <input
                className={styles.input}
                type="password"
                value={entry.apiKey}
                placeholder={
                  entry.existingApiKeyPreview ||
                  (entry.existingApiKey ? maskApiKey(entry.existingApiKey) : undefined) ||
                  (entry.existingApiKeyConfigured
                    ? t('providersPage.form.apiKeyEditPlaceholder')
                    : t('providersPage.form.apiKeyCreatePlaceholder'))
                }
                onChange={(event) => updateKey(tier, index, { apiKey: event.target.value })}
                disabled={mutating}
                autoComplete="new-password"
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>{t('providersPage.form.priority')}</label>
                <input
                  className={styles.input}
                  type="number"
                  value={entry.priority ?? ''}
                  onChange={(event) =>
                    updateKey(tier, index, {
                      priority: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                  disabled={mutating}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t('providersPage.form.weight')}</label>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  value={entry.weight ?? ''}
                  onChange={(event) =>
                    updateKey(tier, index, {
                      weight: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                  disabled={mutating}
                />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{t('providersPage.form.proxyUrl')}</label>
              <input
                className={styles.input}
                value={entry.proxyUrl}
                onChange={(event) => updateKey(tier, index, { proxyUrl: event.target.value })}
                disabled={mutating}
                placeholder="http://127.0.0.1:7890"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => addKey(tier)}
          disabled={mutating}
        >
          <IconPlus size={14} />
          {t('providersPage.openCode.addKey')}
        </button>
        <div className={styles.field}>
          <label className={styles.label}>{t('providersPage.openCode.headers')}</label>
          <textarea
            className={styles.textarea}
            value={value.headersJson}
            onChange={(event) =>
              updateTier(tier, (current) => ({ ...current, headersJson: event.target.value }))
            }
            disabled={mutating}
            placeholder={`{\n  "X-Example": "value"\n}`}
          />
        </div>
      </section>
    );
  };

  return (
    <form
      id={formId}
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('providersPage.openCode.title')}</h3>
        <p className={styles.sectionDesc}>{t('providersPage.openCode.description')}</p>
        <label className={styles.checkboxRow}>
          <input
            className={styles.checkboxBox}
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => update('enabled', event.target.checked)}
            disabled={mutating}
          />
          <span className={styles.checkboxText}>
            <span>{t('providersPage.openCode.enabled')}</span>
            <small>{t('providersPage.openCode.enabledHint')}</small>
          </span>
        </label>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>{t('providersPage.openCode.prefer')}</label>
            <select
              className={styles.input}
              value={form.prefer}
              onChange={(event) => update('prefer', event.target.value as 'zen' | 'go')}
              disabled={mutating}
            >
              <option value="go">OpenCode Go</option>
              <option value="zen">OpenCode Zen</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('providersPage.openCode.refreshSeconds')}</label>
            <input
              className={styles.input}
              type="number"
              min="1"
              max="86400"
              value={form.refreshSeconds}
              onChange={(event) => update('refreshSeconds', Number(event.target.value))}
              disabled={mutating}
            />
          </div>
        </div>
        <label className={styles.checkboxRow}>
          <input
            className={styles.checkboxBox}
            type="checkbox"
            checked={form.anonymous}
            onChange={(event) => update('anonymous', event.target.checked)}
            disabled={mutating}
          />
          <span className={styles.checkboxText}>
            <span>{t('providersPage.openCode.anonymous')}</span>
            <small>{t('providersPage.openCode.anonymousHint')}</small>
          </span>
        </label>
      </section>
      {renderTier('zen', t('providersPage.openCode.zen'), OPENCODE_ZEN_URL)}
      {renderTier('go', t('providersPage.openCode.go'), OPENCODE_GO_URL)}
      <section className={styles.section}>
        <label className={styles.label}>{t('providersPage.openCode.protocolOverrides')}</label>
        <textarea
          className={styles.textarea}
          value={form.protocolOverridesJson}
          onChange={(event) => update('protocolOverridesJson', event.target.value)}
          disabled={mutating}
          placeholder={`{\n  "model-id": "responses"\n}`}
        />
        <p className={styles.sectionDesc}>{t('providersPage.openCode.protocolOverridesHint')}</p>
      </section>
      {error ? <div className={styles.errorBox}>{error}</div> : null}
    </form>
  );
}

import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '../src/i18n/index';
import en from '../src/i18n/locales/en.json';
import ru from '../src/i18n/locales/ru.json';
import zhCN from '../src/i18n/locales/zh-CN.json';
import zhTW from '../src/i18n/locales/zh-TW.json';
import { UsageModelCell, UsageModelDetails } from '../src/features/usage/UsageModelCell';
import { usageModelObservation } from '../src/features/usage/modelObservation';
import { usageDiagnosticBundle } from '../src/features/usage/analytics';
import type { UsageRecord } from '../src/types/usage';

const record = (patch: Partial<UsageRecord> = {}): UsageRecord => ({
  id: 'record-1',
  timestamp: '2026-09-19T00:00:00Z',
  latency_ms: 100,
  ttft_ms: 20,
  provider: 'openai',
  executor_type: 'openai',
  alias: 'legacy-alias',
  model: 'legacy-billing-model',
  endpoint: '/v1/responses',
  source: 'private-account.json',
  auth_id: 'private-account',
  auth_index: '1',
  auth_type: 'oauth',
  api: 'private-api',
  account: 'private-account',
  service_tier: 'default',
  failed: false,
  status_code: 200,
  generate: true,
  tokens: {
    input_tokens: 10,
    output_tokens: 5,
    cached_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    reasoning_tokens: 0,
    total_tokens: 15,
  },
  billing: {
    priced: true,
    currency: 'USD',
    total_usd: 0.01,
    breakdown: { input_usd: 0.01, output_usd: 0, cache_read_usd: 0, cache_write_usd: 0 },
    pricing: {
      version: 'test',
      source: 'test',
      matched_model: 'price-table-model',
      service_tier: 'default',
      estimated: false,
      calculated_at: '2026-09-19T00:00:00Z',
    },
  },
  ...patch,
});

describe('usage model observation semantics', () => {
  test('accepts a legitimate request mapping when the sent and reported models agree', () => {
    const observed = usageModelObservation({
      requested_model: 'friendly-alias',
      upstream_model: 'gpt-real',
      upstream_response_model: 'gpt-real',
      upstream_response_model_source: 'body',
    });
    expect(observed.primary).toBe('friendly-alias');
    expect(observed.mapped).toBe(true);
    expect(observed.match).toBe('matched');
    expect(observed.source).toBe('body');
  });

  test('trims whitespace but preserves case and version differences', () => {
    expect(
      usageModelObservation({
        upstream_model: ' gpt-real\t',
        upstream_response_model: '\ngpt-real ',
      }).match
    ).toBe('matched');
    expect(
      usageModelObservation({ upstream_model: 'gpt-real', upstream_response_model: 'GPT-real' })
        .match
    ).toBe('mismatch');
    expect(
      usageModelObservation({
        upstream_model: 'gpt-real',
        upstream_response_model: 'gpt-real-2026-09-19',
      }).match
    ).toBe('mismatch');
  });

  test('uses legacy names only for display, never as actual sent or reported evidence', () => {
    const legacy = usageModelObservation({
      model: 'stored-model',
      alias: 'old-alias',
      model_match: 'matched',
    });
    expect(legacy).toEqual({
      primary: 'old-alias',
      requested: '',
      sent: '',
      returned: '',
      source: null,
      match: 'unknown',
      mapped: false,
    });
    expect(usageModelObservation({ model: 'stored-model' }).primary).toBe('stored-model');
    expect(
      usageModelObservation({
        model: 'stored-model',
        alias: 'old-alias',
        requested_model: ' actual-request ',
      }).primary
    ).toBe('actual-request');
  });

  test('requires both model names even when a header source or matched flag exists', () => {
    expect(
      usageModelObservation({
        upstream_model: 'gpt-real',
        upstream_response_model_source: 'header',
        model_match: 'matched',
      }).match
    ).toBe('unknown');
    expect(
      usageModelObservation({
        upstream_model: 'gpt-real',
        upstream_response_model: ' ',
        upstream_response_model_source: 'header',
      }).source
    ).toBeNull();
    expect(
      usageModelObservation({ upstream_response_model: 'gpt-real', model_match: 'matched' }).match
    ).toBe('unknown');
    expect(
      usageModelObservation({
        upstream_model: 'gpt-real',
        upstream_response_model: 'another',
        model_match: 'matched',
      }).match
    ).toBe('mismatch');
  });

  test('keeps response source explicit and rejects arbitrary source metadata', () => {
    for (const source of ['header', 'body', 'metadata'] as const)
      expect(
        usageModelObservation({
          upstream_response_model: 'gpt-real',
          upstream_response_model_source: source,
        }).source
      ).toBe(source);
    expect(usageModelObservation({ upstream_response_model: 'gpt-real' }).source).toBeNull();
    expect(
      usageModelObservation({
        upstream_response_model: 'gpt-real',
        upstream_response_model_source: 'secret-source-value' as 'header',
      }).source
    ).toBeNull();
  });
});

describe('usage model rendering', () => {
  test('shows original, sent, and reported names while treating mapping separately from mismatch', () => {
    const markup = renderToStaticMarkup(
      createElement(UsageModelCell, {
        record: record({
          requested_model: 'friendly-alias',
          upstream_model: 'gpt-real',
          upstream_response_model: 'gpt-real',
        }),
      })
    );
    expect(markup).toContain('friendly-alias');
    expect(markup).toContain('gpt-real');
    expect(markup).toContain('data-match="matched"');
    expect(markup).toContain(i18n.t('usage_stats.model_mapped'));
    expect(markup).not.toContain('legacy-alias');
    expect(markup).not.toContain('price-table-model');
  });

  test('shows a missing report as unknown rather than a successful match', () => {
    const markup = renderToStaticMarkup(
      createElement(UsageModelCell, {
        record: record({
          requested_model: 'friendly-alias',
          upstream_model: 'gpt-real',
          upstream_response_model_source: 'header',
        }),
      })
    );
    expect(markup).toContain('data-match="unknown"');
    expect(markup).toContain(i18n.t('usage_stats.model_not_reported'));
    expect(markup).not.toContain('data-match="matched"');
  });

  test('details separate observed models, report source and pricing match', () => {
    const markup = renderToStaticMarkup(
      createElement(UsageModelDetails, {
        record: record({
          requested_model: 'client-model',
          upstream_model: 'sent-model',
          upstream_response_model: 'returned-model',
          upstream_response_model_source: 'metadata',
        }),
      })
    );
    for (const value of ['client-model', 'sent-model', 'returned-model', 'price-table-model'])
      expect(markup).toContain(value);
    expect(markup).toContain('data-match="mismatch"');
    expect(markup).toContain(i18n.t('usage_stats.model_source_metadata'));
    expect(markup).toContain(i18n.t('usage_stats.model_observation_note'));
    const legacy = renderToStaticMarkup(createElement(UsageModelDetails, { record: record() }));
    expect(legacy).not.toContain('legacy-alias');
    expect(legacy).not.toContain('legacy-billing-model');
    expect(legacy).toContain(i18n.t('usage_stats.not_recorded'));
    expect(legacy).toContain('data-match="unknown"');
  });

  test('translates all model observation states and labels in all four locales', () => {
    for (const locale of [en, ru, zhCN, zhTW]) {
      const strings = locale.usage_stats;
      for (const key of [
        'model_match_matched',
        'model_match_mismatch',
        'model_match_unknown',
        'model_match_hint_matched',
        'model_match_hint_mismatch',
        'model_match_hint_unknown',
        'sent_model',
        'returned_model',
        'sent_short',
        'returned_short',
        'model_mapped',
        'model_mapping_hint',
        'model_not_reported',
        'model_observation_missing',
        'model_observation_title',
        'model_response_source',
        'model_source_header',
        'model_source_body',
        'model_source_metadata',
        'model_observation_note',
      ] as const)
        expect(strings[key].length).toBeGreaterThan(0);
    }
  });
});

describe('model observation in sanitized diagnostics', () => {
  test('exports only derived status and allowlisted source, omitting every model name', () => {
    const payload = usageDiagnosticBundle(
      record({
        requested_model: 'private-request-name',
        upstream_model: 'private-sent-name',
        upstream_response_model: 'private-response-name',
        upstream_response_model_source: 'header',
      })
    );
    expect(payload.record.model_match).toBe('mismatch');
    expect(payload.record.upstream_response_model_source).toBe('header');
    const serialized = JSON.stringify(payload);
    for (const value of [
      'private-request-name',
      'private-sent-name',
      'private-response-name',
      'price-table-model',
      'legacy-alias',
      'legacy-billing-model',
    ])
      expect(serialized).not.toContain(value);
    const unsafe = usageDiagnosticBundle(
      record({
        upstream_response_model: 'model',
        upstream_response_model_source: 'private-source' as 'header',
      })
    );
    expect(unsafe.record.upstream_response_model_source).toBeNull();
    expect(JSON.stringify(unsafe)).not.toContain('private-source');
  });
});

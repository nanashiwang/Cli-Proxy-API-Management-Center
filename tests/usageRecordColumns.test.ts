import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '../src/i18n/index';
import en from '../src/i18n/locales/en.json';
import ru from '../src/i18n/locales/ru.json';
import zhCN from '../src/i18n/locales/zh-CN.json';
import zhTW from '../src/i18n/locales/zh-TW.json';
import { UsageRecordsTable } from '../src/features/usage/UsageRecordsTable';
import { UsageRequestMetadata } from '../src/features/usage/UsageRequestMetadata';
import { usageRecordedText, usageTransportLabel } from '../src/features/usage/recordPresentation';
import { usageDiagnosticBundle } from '../src/features/usage/analytics';
import type { UsageRecord, UsageSort } from '../src/types/usage';

const makeRecord = (patch: Partial<UsageRecord> = {}): UsageRecord => ({
  id: 'record-new-fields',
  timestamp: '2026-09-19T01:00:00Z',
  latency_ms: 1456,
  ttft_ms: 123,
  provider: 'codex',
  executor_type: 'CodexExecutor',
  alias: 'friendly-model',
  model: 'billing-model',
  requested_model: 'friendly-model',
  upstream_model: 'sent-model',
  upstream_response_model: 'sent-model',
  endpoint: '/v1/responses',
  source: 'account.json',
  auth_id: 'readable-account',
  auth_index: '1',
  auth_type: 'oauth',
  api: 'private-api-key',
  account: 'auth_index:1',
  service_tier: 'default',
  failed: false,
  status_code: 200,
  generate: true,
  reasoning_effort: 'high',
  upstream_transport: 'ws',
  client_transport: 'sse',
  client_ip: '2001:db8:1234:5678:90ab:cdef:1234:5678',
  user_agent: 'ExampleClient/2.0 <private-device> (long-agent-details)',
  tokens: {
    input_tokens: 100,
    output_tokens: 200,
    cached_tokens: 30,
    cache_read_tokens: 30,
    cache_write_tokens: 0,
    reasoning_tokens: 10,
    total_tokens: 340,
  },
  billing: {
    priced: true,
    currency: 'USD',
    total_usd: 0.002,
    breakdown: { input_usd: 0.001, output_usd: 0.001, cache_read_usd: 0, cache_write_usd: 0 },
    pricing: {
      version: 'test',
      source: 'test',
      matched_model: 'billing-model',
      service_tier: 'default',
      estimated: false,
      calculated_at: '2026-09-19T01:00:00Z',
    },
  },
  ...patch,
});

function renderTable(records = [makeRecord()], sort: UsageSort = 'timestamp', loading = false) {
  return renderToStaticMarkup(
    createElement(UsageRecordsTable, {
      records,
      loading,
      sort,
      order: 'desc',
      onSort: () => {},
      onViewDetail: () => {},
      emptyContent: 'empty-record-list',
    })
  );
}

function cells(markup: string, section: 'thead' | 'tbody', cell: 'th' | 'td') {
  const sectionMarkup =
    markup.match(new RegExp(`<${section}>([\\s\\S]*?)</${section}>`))?.[1] || '';
  return [
    ...sectionMarkup.matchAll(new RegExp(`<${cell}(?:\\s[^>]*)?>([\\s\\S]*?)</${cell}>`, 'g')),
  ].map((match) => match[1]);
}

describe('usage record columns', () => {
  test('renders every requested column in order with status and observed models retained', () => {
    const markup = renderTable();
    const headers = cells(markup, 'thead', 'th');
    const rows = cells(markup, 'tbody', 'td');
    expect(headers).toHaveLength(14);
    expect(rows).toHaveLength(14);
    const labels = [
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
    ];
    labels.forEach((label, index) =>
      expect(headers[index]).toContain(i18n.t(`usage_stats.${label}`))
    );
    expect(rows[0]).toContain('readable-account');
    expect(rows[0]).not.toContain('auth_index:1');
    expect(rows[0]).toContain('200');
    expect(rows[1]).toContain('codex');
    expect(rows[1]).toContain('oauth');
    expect(rows[2]).toContain('friendly-model');
    expect(rows[2]).toContain('sent-model');
    expect(rows[2]).toContain('data-match="matched"');
    expect(rows[3]).toContain('high');
    expect(rows[4]).toContain('/v1/responses');
    expect(rows[5]).toContain('data-transport="ws"');
    expect(rows[6]).toContain('data-transport="sse"');
    expect(rows[13]).toContain('<button');
    expect(rows[13]).toContain(i18n.t('usage_stats.details_action'));
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain(i18n.t('usage_stats.client_ip_hint'));
  });

  test('keeps independent total latency and first-token sort controls in one column', () => {
    const markup = renderTable([makeRecord()], 'ttft');
    const headers = cells(markup, 'thead', 'th');
    expect(headers).toHaveLength(14);
    expect(headers[9]).toContain(
      i18n.t('usage_stats.sort_record_column', { column: i18n.t('usage_stats.latency') })
    );
    expect(headers[9]).toContain(
      i18n.t('usage_stats.sort_record_column', { column: i18n.t('usage_stats.ttft') })
    );
    expect(headers[9].match(/<button/g)).toHaveLength(2);
    expect(headers[9]).toContain('aria-pressed="true"');
    expect(headers[9]).toContain('aria-pressed="false"');
    const latencyHeader = markup.match(/<th[^>]*aria-sort="descending"[^>]*>([\s\S]*?)<\/th>/)?.[1];
    expect(latencyHeader).toBe(headers[9]);
    expect(cells(markup, 'tbody', 'td')[9]).toContain('123');
  });

  test('keeps IP and full escaped User-Agent available through native expandable controls', () => {
    const markup = renderTable();
    const rows = cells(markup, 'tbody', 'td');
    expect(rows[11]).toContain('<details');
    expect(rows[11]).toContain('<code>2001:db8:1234:5678:90ab:cdef:1234:5678</code>');
    expect(rows[12]).toContain('<details');
    expect(rows[12]).toContain(
      '<code>ExampleClient/2.0 &lt;private-device&gt; (long-agent-details)</code>'
    );
    expect(rows[12]).not.toContain('<private-device>');
    expect(rows[12]).toContain(
      i18n.t('usage_stats.expand_record_value', { field: i18n.t('usage_stats.user_agent') })
    );
  });

  test('historical missing values remain unrecorded despite familiar endpoint, provider and errors', () => {
    const markup = renderTable([
      makeRecord({
        upstream_transport: undefined,
        client_transport: undefined,
        reasoning_effort: undefined,
        client_ip: undefined,
        user_agent: undefined,
        failed: true,
        status_code: 502,
        generate: false,
      }),
    ]);
    const rows = cells(markup, 'tbody', 'td');
    for (const index of [3, 5, 6, 11, 12])
      expect(rows[index]).toContain(i18n.t('usage_stats.not_recorded'));
    for (const index of [5, 6]) {
      expect(rows[index]).toContain('data-transport="unknown"');
      expect(rows[index]).not.toContain('data-transport="http"');
    }
    expect(rows[0]).toContain('502');
    expect(rows[0]).toContain(i18n.t('usage_stats.warmup'));
    const failed = cells(
      renderTable([makeRecord({ failed: true, status_code: 502 })]),
      'tbody',
      'td'
    );
    expect(failed[6]).toContain('data-transport="sse"');
  });

  test('loading and empty states stay outside the wide scrolling table with all headers retained', () => {
    for (const markup of [renderTable([], 'timestamp', true), renderTable([])]) {
      expect(cells(markup, 'thead', 'th')).toHaveLength(14);
      expect(cells(markup, 'tbody', 'td')).toHaveLength(0);
      expect(markup).toContain('</table></div><div');
    }
    expect(renderTable([]).split('</table>')[1]).toContain('empty-record-list');
    expect(renderTable([], 'timestamp', true).split('</table>')[1]).toContain(
      i18n.t('common.loading')
    );
  });
});

describe('request metadata semantics and details', () => {
  test('accepts only captured transport values and preserves explicit reasoning none', () => {
    expect(usageTransportLabel('http')).toBe('HTTP');
    expect(usageTransportLabel('sse')).toBe('SSE');
    expect(usageTransportLabel('ws')).toBe('WS');
    for (const value of [undefined, null, '', 'websocket', 'HTTP', ' ws ', '/v1/responses'])
      expect(usageTransportLabel(value)).toBeNull();
    expect(usageRecordedText(' none ')).toBe('none');
    for (const value of ['', ' ', undefined, null]) expect(usageRecordedText(value)).toBeNull();
  });

  test('details show separate directions, full network metadata and the connection IP meaning', () => {
    const markup = renderToStaticMarkup(
      createElement(UsageRequestMetadata, { record: makeRecord() })
    );
    for (const key of [
      'reasoning_effort',
      'upstream_transport',
      'client_transport',
      'client_ip',
      'user_agent',
    ])
      expect(markup).toContain(i18n.t(`usage_stats.${key}`));
    expect(markup).toContain('data-transport="ws"');
    expect(markup).toContain('data-transport="sse"');
    expect(markup).toContain('2001:db8:1234:5678:90ab:cdef:1234:5678');
    expect(markup).toContain('ExampleClient/2.0 &lt;private-device&gt; (long-agent-details)');
    expect(markup).toContain(i18n.t('usage_stats.client_ip_hint'));
    expect(markup).not.toContain(i18n.t('usage_stats.aistudio_transport_note'));
    const relayed = renderToStaticMarkup(
      createElement(UsageRequestMetadata, {
        record: makeRecord({
          executor_type: 'AIStudioExecutor',
          upstream_transport: 'http',
        }),
      })
    );
    expect(relayed).toContain(i18n.t('usage_stats.aistudio_transport_note'));
    expect(relayed).toContain('data-transport="http"');
    const historical = renderToStaticMarkup(
      createElement(UsageRequestMetadata, {
        record: makeRecord({ executor_type: 'AIStudioExecutor', upstream_transport: undefined }),
      })
    );
    expect(historical).not.toContain(i18n.t('usage_stats.aistudio_transport_note'));
    expect(historical).toContain('data-transport="unknown"');
  });

  test('diagnostic allowlist excludes network identifiers even with arbitrary future metadata', () => {
    const record = {
      ...makeRecord(),
      metadata: { client_ip: 'secret-metadata-ip', user_agent: 'secret-metadata-agent' },
      unknown_future_field: 'private-future-field',
    };
    const payload = usageDiagnosticBundle(record);
    const serialized = JSON.stringify(payload);
    for (const value of [
      record.client_ip!,
      record.user_agent!,
      'secret-metadata-ip',
      'secret-metadata-agent',
      'private-future-field',
    ])
      expect(serialized).not.toContain(value);
    expect(payload.record).not.toHaveProperty('client_ip');
    expect(payload.record).not.toHaveProperty('user_agent');
    expect(payload.omitted).toContain('client_ip');
    expect(payload.omitted).toContain('user_agent');
    expect(payload.record.status_code).toBe(200);
    expect(payload.record.tokens.total_tokens).toBe(340);
    expect(payload.record.model_match).toBe('matched');
  });

  test('all four languages include labels, transport semantics, privacy and expand hints', () => {
    for (const locale of [en, ru, zhCN, zhTW]) {
      for (const key of [
        'provider_type',
        'reasoning_effort',
        'upstream_transport',
        'client_transport',
        'upstream_transport_hint',
        'client_transport_hint',
        'request_latency',
        'client_ip',
        'client_ip_hint',
        'user_agent',
        'actions',
        'details_action',
        'expand_record_value',
        'sort_record_column',
        'records_scroll_hint',
        'request_metadata_title',
        'aistudio_transport_note',
      ] as const)
        expect(locale.usage_stats[key].length).toBeGreaterThan(0);
      expect(locale.usage_stats.diagnostic_export_note).toContain('IP');
      expect(locale.usage_stats.diagnostic_export_note).toContain('User-Agent');
    }
  });
});

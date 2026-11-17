import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '../src/i18n/index';
import { UsageInsights } from '../src/features/usage/UsageInsights';
import { diagnosticFailureCategory } from '../src/features/usage/diagnostics';
import type { UsageDashboard } from '../src/types/usage';
import fixture from './fixtures/usage-service-health.json';

const render = (data: UsageDashboard) =>
  renderToStaticMarkup(createElement(UsageInsights, { data, onDimension: () => {} }));
const sample = (): UsageDashboard => structuredClone(fixture) as UsageDashboard;

test('service rate excludes caller outcomes while overall request rate stays visible', () => {
  const html = render(sample());
  expect(html).toContain('66.7%');
  expect(html).toContain('40.0%');
  expect(html).toContain('33.3%');
  expect(html).toContain(i18n.t('usage_stats.service_health_description'));
  expect(diagnosticFailureCategory('stream_incomplete')).toBe('stream_incomplete');
});

test('no service samples show unavailable, never fabricated zero or 100 percent', () => {
  const data = sample();
  const unavailable = {
    ...data.health.service!,
    succeeded: 0,
    failed: 0,
    incomplete: 0,
    samples: 0,
    success_rate: null,
    error_rate: null,
  };
  data.health.service = unavailable;
  data.trend.forEach((p) => {
    p.service = unavailable;
  });
  data.dimensions.models.forEach((p) => {
    p.service = unavailable;
  });
  const html = render(data);
  expect(html).toContain(`${i18n.t('usage_stats.service_success_rate')}</span><strong>—`);
  expect(html).not.toContain('66.7%');
});

test('older backends retain the legacy health chart and dimension rate', () => {
  const data = sample();
  delete data.health.service;
  data.trend.forEach((p) => {
    delete p.service;
  });
  data.dimensions.models.forEach((p) => {
    delete p.service;
  });
  const html = render(data);
  expect(html).not.toContain(i18n.t('usage_stats.service_health_description'));
  expect(html).toContain('60.0%');
  expect(html).toContain('40.0%');
});

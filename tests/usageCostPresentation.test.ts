import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '../src/i18n/index';
import { usageCostRows, usageRecordedCost } from '../src/features/usage/costPresentation';
import { UsageReasoningEffort } from '../src/features/usage/UsageRequestMetadata';
import type { UsageBilling } from '../src/types/usage';

const billing: UsageBilling = {
  priced: true,
  currency: 'USD',
  total_usd: 0.0157,
  breakdown: { input_usd: 0.001, output_usd: 0.002, cache_read_usd: 0.0127, cache_write_usd: 0 },
  pricing: {
    source: 'snapshot',
    version: 'saved-version',
    matched_model: 'saved-model',
    service_tier: 'default',
    estimated: true,
    calculated_at: '2026-09-19T00:00:00Z',
    unit_prices_usd_per_million_tokens: { input: 2, output: 12, cache_read: 0.2, cache_write: 0 },
  },
};

test('uses stored rates and breakdown, retaining genuine zeros', () => {
  expect(usageCostRows({ billing })).toEqual([
    { key: 'input', unitPrice: 2, cost: 0.001 },
    { key: 'output', unitPrice: 12, cost: 0.002 },
    { key: 'cache_read', unitPrice: 0.2, cost: 0.0127 },
    { key: 'cache_write', unitPrice: 0, cost: 0 },
  ]);
  expect(usageRecordedCost({ billing })).toBe(0.0157);
  expect(usageRecordedCost({ billing, cost_usd: 0 })).toBe(0);
});

test('missing historical rates remain unknown without discarding saved amounts', () => {
  const legacy = {
    ...billing,
    pricing: { ...billing.pricing, unit_prices_usd_per_million_tokens: undefined },
  };
  expect(usageCostRows({ billing: legacy }).every((row) => row.unitPrice === null)).toBe(true);
  expect(usageCostRows({ billing: legacy })[0].cost).toBe(0.001);
  expect(usageRecordedCost({})).toBeNull();
});

test('unpriced records do not present zero-filled snapshots as free prices', () => {
  const unpriced = { ...billing, priced: false, total_usd: 0 };
  expect(usageRecordedCost({ billing: unpriced, cost_usd: 0 })).toBeNull();
  expect(
    usageCostRows({ billing: unpriced }).every((row) => row.unitPrice === null && row.cost === null)
  ).toBe(true);
});

test('paid legacy snapshots with zero-filled Go rates remain unknown', () => {
  const legacy = {
    ...billing,
    pricing: {
      ...billing.pricing,
      unit_prices_usd_per_million_tokens: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
    },
  };
  expect(usageCostRows({ billing: legacy }).every((row) => row.unitPrice === null)).toBe(true);
  expect(
    usageCostRows({ billing: { ...legacy, total_usd: 0 } }).every((row) => row.unitPrice === 0)
  ).toBe(true);
});

test('reasoning modes and absent historical settings stay distinct', () => {
  for (const mode of ['default', 'auto', 'enabled', 'none']) {
    const markup = renderToStaticMarkup(createElement(UsageReasoningEffort, { value: mode }));
    expect(markup).toContain(i18n.t(`usage_stats.reasoning_${mode}`));
    expect(markup).toContain(i18n.t(`usage_stats.reasoning_hint_${mode}`));
  }
  expect(renderToStaticMarkup(createElement(UsageReasoningEffort, { value: undefined }))).toContain(
    i18n.t('usage_stats.not_recorded')
  );
  expect(renderToStaticMarkup(createElement(UsageReasoningEffort, { value: 'xhigh' }))).toContain(
    'xhigh'
  );
});

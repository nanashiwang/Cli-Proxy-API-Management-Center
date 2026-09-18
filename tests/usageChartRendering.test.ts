import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import '../src/i18n/index';
import { UsageChart } from '../src/features/usage/UsageChart';

describe('usage chart availability', () => {
  test('draws a genuine zero-cost series instead of reporting missing data', () => {
    const markup = renderToStaticMarkup(
      createElement(UsageChart, {
        labels: ['10:00', '11:00'],
        series: [{ label: 'Cost', color: 'green', values: [0, 0] }],
        format: String,
        hasActivity: true,
      })
    );
    expect(markup).toContain('<svg');
    expect(markup).toContain('aria-label="10:00: Cost 0"');
  });
  test('does not draw unpriced samples or empty activity as measured zero', () => {
    const unknown = renderToStaticMarkup(
      createElement(UsageChart, {
        labels: ['10:00'],
        series: [{ label: 'Cost', color: 'green', values: [null] }],
        format: String,
        hasActivity: true,
      })
    );
    const empty = renderToStaticMarkup(
      createElement(UsageChart, {
        labels: ['10:00'],
        series: [{ label: 'Requests', color: 'green', values: [0] }],
        format: String,
        hasActivity: false,
      })
    );
    expect(unknown).not.toContain('<svg');
    expect(empty).not.toContain('<svg');
  });
});

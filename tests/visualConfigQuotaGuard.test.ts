import { expect, test } from 'bun:test';
import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse } from 'yaml';
import { getVisualConfigValidationErrors, useVisualConfig } from '../src/hooks/useVisualConfig';
import { DEFAULT_VISUAL_VALUES } from '../src/types/visualConfig';

test('quota guard validates coupled bounds and accepts zero jitter', () => {
  expect(
    getVisualConfigValidationErrors(DEFAULT_VISUAL_VALUES).codexQuotaFiveHourPercent
  ).toBeUndefined();
  expect(
    getVisualConfigValidationErrors({ ...DEFAULT_VISUAL_VALUES, codexQuotaWeeklyPercent: '99' })
      .codexQuotaWeeklyPercent
  ).toBe('quota_guard_range');
  expect(
    getVisualConfigValidationErrors({ ...DEFAULT_VISUAL_VALUES, codexQuotaFiveHourJitter: '0' })
      .codexQuotaFiveHourJitter
  ).toBeUndefined();
  expect(
    getVisualConfigValidationErrors({ ...DEFAULT_VISUAL_VALUES, codexQuotaFiveHourPercent: '' })
      .codexQuotaFiveHourPercent
  ).toBe('quota_guard_range');
});

test('quota guard writes only changed keys and preserves unknown settings', () => {
  let output = '';
  function Harness() {
    const config = useVisualConfig();
    const [phase, setPhase] = useState(0);
    if (phase === 0) {
      config.setVisualValues({ codexQuotaGuardEnabled: false, codexQuotaFiveHourJitter: '2' });
      setPhase(1);
    } else {
      output = config.applyVisualChangesToYaml(
        'codex-quota-guard:\n  future-option: true\nother: keep\n'
      );
    }
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  expect(parse(output)).toEqual({
    'codex-quota-guard': { 'future-option': true, enabled: false, 'five-hour-jitter': 2 },
    other: 'keep',
  });
});

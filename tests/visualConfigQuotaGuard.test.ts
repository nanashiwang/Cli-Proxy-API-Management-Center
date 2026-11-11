import { expect, test } from 'bun:test';
import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse } from 'yaml';
import { getVisualConfigValidationErrors, useVisualConfig } from '../src/hooks/useVisualConfig';
import { DEFAULT_VISUAL_VALUES } from '../src/types/visualConfig';

test('quota guard validates coupled bounds and accepts zero jitter', () => {
  expect(
    getVisualConfigValidationErrors(DEFAULT_VISUAL_VALUES).quotaGuardFiveHourPercent
  ).toBeUndefined();
  expect(
    getVisualConfigValidationErrors({ ...DEFAULT_VISUAL_VALUES, quotaGuardWeeklyPercent: '99' })
      .quotaGuardWeeklyPercent
  ).toBe('quota_guard_range');
  expect(
    getVisualConfigValidationErrors({ ...DEFAULT_VISUAL_VALUES, quotaGuardFiveHourJitter: '0' })
      .quotaGuardFiveHourJitter
  ).toBeUndefined();
  expect(
    getVisualConfigValidationErrors({ ...DEFAULT_VISUAL_VALUES, quotaGuardFiveHourPercent: '' })
      .quotaGuardFiveHourPercent
  ).toBe('quota_guard_range');
});

test('quota guard writes only changed keys and preserves unknown settings', () => {
  let output = '';
  function Harness() {
    const config = useVisualConfig();
    const [phase, setPhase] = useState(0);
    if (phase === 0) {
      config.setVisualValues({ quotaGuardEnabled: false, quotaGuardFiveHourJitter: '2' });
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
    'codex-quota-guard': { 'future-option': true },
    'quota-guard': { enabled: false, 'five-hour-jitter': 2 },
    other: 'keep',
  });
});

test('common settings overlay legacy Codex values and load monthly defaults', () => {
  let values = DEFAULT_VISUAL_VALUES;
  function Harness() {
    const config = useVisualConfig();
    const [phase, setPhase] = useState(0);
    if (phase === 0) {
      config.loadVisualValuesFromYaml(
        'codex-quota-guard:\n  enabled: false\n  weekly-used-percent: 88\nquota-guard:\n  enabled: true\n  five-hour-jitter: 2\n'
      );
      setPhase(1);
    } else {
      values = config.visualValues;
    }
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  expect(values.quotaGuardEnabled).toBe(true);
  expect(values.quotaGuardWeeklyPercent).toBe('88');
  expect(values.quotaGuardFiveHourJitter).toBe('2');
  expect(values.quotaGuardMonthlyPercent).toBe('93');
  expect(
    getVisualConfigValidationErrors({ ...values, quotaGuardMonthlyPercent: '99' })
      .quotaGuardMonthlyPercent
  ).toBe('quota_guard_range');
});

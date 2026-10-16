import { expect, test } from 'bun:test';
import { observedDuration, recordFirstByte, recordFirstOutput } from '../src/features/usage/timing';
import { diagnosticFailureCategory } from '../src/features/usage/diagnostics';
import { normalizeLogHealth } from '../src/services/api/logs';
import type { UsageRequestDetail } from '../src/types/usage';
import en from '../src/i18n/locales/en.json';
import zh from '../src/i18n/locales/zh-CN.json';
import tw from '../src/i18n/locales/zh-TW.json';
import ru from '../src/i18n/locales/ru.json';

test('legacy first-byte data never becomes first output and measured zero survives', () => {
  const legacy = { ttft_ms: 123 } as UsageRequestDetail;
  expect(recordFirstByte(legacy)).toBe(123);
  expect(recordFirstOutput(legacy)).toBeNull();
  expect(recordFirstOutput({ ...legacy, timing: { first_output_ms: 0 } })).toBe(0);
  for (const value of [-1, Infinity, NaN, '42', undefined, null]) {
    expect(observedDuration(value)).toBeNull();
  }
});

test('log health is optional, validated and detached from arbitrary server fields', () => {
  expect(normalizeLogHealth(undefined)).toBeUndefined();
  expect(normalizeLogHealth({ dropped_records: 1 })).toBeUndefined();
  const sample = {
    dropped_records: 2,
    dropped_errors: 1,
    write_errors: 0,
    stream_chunks_dropped: 0,
    forwarded_logs_dropped: 0,
    queued_records: 3,
    queued_bytes: 20,
    secret: 'private',
  };
  expect(normalizeLogHealth(sample)?.dropped_records).toBe(2);
  expect(JSON.stringify(normalizeLogHealth(sample))).not.toContain('private');
  expect(normalizeLogHealth({ ...sample, write_errors: -1 })).toBeUndefined();
});

test('failure causes and timing labels are allowlisted in every supported locale', () => {
  expect(diagnosticFailureCategory('private-secret')).toBe('unknown');
  for (const locale of [en, zh, tw, ru]) {
    expect(locale.usage_stats.first_byte).toBeTruthy();
    expect(locale.usage_stats.local_throughput).toBeTruthy();
    expect(locale.logs.health_incomplete).toContain('{{dropped}}');
    for (const cause of Object.keys(en.usage_stats.failure_categories)) {
      expect(diagnosticFailureCategory(cause)).toBe(cause);
      expect(
        locale.usage_stats.failure_categories[
          cause as keyof typeof en.usage_stats.failure_categories
        ]
      ).toBeTruthy();
    }
  }
});

import { expect, test } from 'bun:test';
import {
  normalizeUsageDiagnostics,
  redactedUsageDiagnostics,
} from '../src/features/usage/diagnostics';
import type { UsageDiagnostics } from '../src/types/usage';
const sample: UsageDiagnostics = {
  trace_id: 'private-trace',
  started_at: '2026-09-28T00:00:00Z',
  captured_at: '2026-09-28T00:00:01Z',
  truncated: false,
  attempts: [
    {
      sequence: 1,
      provider: 'private-provider',
      auth_id: 'private-account',
      model: 'private-model',
      started_at: '2026-09-28T00:00:00Z',
      ended_at: '2026-09-28T00:00:01Z',
      outcome: 'failed',
      status_code: 429,
      phase: 'upstream_headers',
      retry_reason: 'initial',
      transport: 'sse',
      first_byte_ms: 0,
    },
  ],
  events: [{ attempt: 1, kind: 'upstream_request', offset_ms: 0 }],
};
test('exports only enumerated diagnostic metrics, never account identifiers or injected fields', () => {
  const data = {
    ...sample,
    attempts: sample.attempts.map((a) => ({
      ...a,
      secret: 'private-secret',
      phase: 'private-secret',
    })),
    events: [...sample.events, { attempt: 1, kind: 'private-secret', offset_ms: 0 }],
  };
  const exported = redactedUsageDiagnostics(data)!;
  expect(exported.attempts[0].phase).toBe('unknown');
  expect(exported.attempts[0].duration_ms).toBe(1000);
  expect(exported.attempts[0].first_byte_ms).toBe(0);
  expect(exported.events).toHaveLength(1);
  expect(JSON.stringify(exported)).not.toContain('private-');
});
test('old data remains unavailable and unbounded payloads are capped', () => {
  expect(normalizeUsageDiagnostics(undefined)).toBeUndefined();
  const oversized = {
    ...sample,
    attempts: Array(40).fill(sample.attempts[0]),
    events: Array(120).fill(sample.events[0]),
  };
  const data = normalizeUsageDiagnostics(oversized)!;
  expect(data.attempts).toHaveLength(32);
  expect(data.events).toHaveLength(96);
  expect(data.truncated).toBe(true);
});

import type { UsageDiagnostics } from '@/types/usage';

export const DIAGNOSTIC_EVENTS = [
  'upstream_request',
  'upstream_headers',
  'first_byte',
  'response_started',
  'interrupt_sent',
  'interrupt_confirmed',
  'interrupt_rejected',
  'http_size_fallback',
  'replay_required',
  'buffer_byte_limit',
  'buffer_event_limit',
  'buffer_output',
  'buffer_terminal',
  'buffer_upstream_error',
];
const enumeration = (value: unknown, values: string[]) =>
  typeof value === 'string' && values.includes(value) ? value : 'unknown';
export const diagnosticOutcome = (value: unknown) =>
  enumeration(value, ['running', 'succeeded', 'failed', 'cancelled', 'interrupted']);
export const diagnosticPhase = (value: unknown) =>
  enumeration(value, ['executor', 'upstream_request', 'upstream_headers', 'response_body']);
export const diagnosticReason = (value: unknown) =>
  enumeration(value, ['initial', 'same_account_retry', 'account_switch', 'model_fallback']);
export function normalizeUsageDiagnostics(
  value: UsageDiagnostics | undefined
): UsageDiagnostics | undefined {
  if (
    !value ||
    !Array.isArray(value.attempts) ||
    !Array.isArray(value.events) ||
    !Number.isFinite(Date.parse(value.started_at)) ||
    !Number.isFinite(Date.parse(value.captured_at))
  )
    return undefined;
  const attempts = value.attempts
    .slice(0, 32)
    .filter(
      (a) =>
        a &&
        Number.isSafeInteger(a.sequence) &&
        a.sequence > 0 &&
        a.sequence <= 32 &&
        Number.isFinite(Date.parse(a.started_at))
    )
    .map((a) => ({
      ...a,
      outcome: diagnosticOutcome(a.outcome),
      phase: diagnosticPhase(a.phase),
      retry_reason: diagnosticReason(a.retry_reason),
    }));
  const sequences = new Set(attempts.map((a) => a.sequence));
  return {
    ...value,
    attempts,
    truncated: value.truncated === true || value.attempts.length > 32 || value.events.length > 96,
    events: value.events
      .slice(0, 96)
      .filter(
        (e) =>
          e &&
          sequences.has(e.attempt) &&
          DIAGNOSTIC_EVENTS.includes(e.kind) &&
          Number.isFinite(e.offset_ms) &&
          e.offset_ms >= 0
      ),
  };
}
// Deliberately omit account IDs, models, providers and arbitrary fields from exports.
export function redactedUsageDiagnostics(value: UsageDiagnostics | undefined) {
  const data = normalizeUsageDiagnostics(value);
  if (!data) return null;
  const number = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null);
  return {
    captured_at: data.captured_at,
    truncated: data.truncated,
    attempts: data.attempts.map((a) => ({
      sequence: a.sequence,
      outcome: a.outcome,
      phase: a.phase,
      retry_reason: a.retry_reason,
      status_code: number(a.status_code),
      transport: enumeration(a.transport, ['http', 'sse', 'ws']),
      first_byte_ms: number(a.first_byte_ms),
      duration_ms: a.ended_at ? number(Date.parse(a.ended_at) - Date.parse(a.started_at)) : null,
    })),
    events: data.events.map((e) => ({ attempt: e.attempt, kind: e.kind, offset_ms: e.offset_ms })),
  };
}

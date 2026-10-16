import type { UsageRequestDetail } from '@/types/usage';

export function observedDuration(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function recordFirstOutput(record: UsageRequestDetail): number | null {
  return observedDuration(record.timing?.first_output_ms);
}

export function recordFirstByte(record: UsageRequestDetail): number | null {
  return (
    observedDuration(record.timing?.first_byte_ms) ??
    (record.ttft_ms > 0 ? observedDuration(record.ttft_ms) : null)
  );
}

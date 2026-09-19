import type { UsageModelMatch, UsageModelResponseSource, UsageRequestDetail } from '@/types/usage';

type ModelObservationRecord = Partial<
  Pick<
    UsageRequestDetail,
    | 'alias'
    | 'requested_model'
    | 'upstream_model'
    | 'upstream_response_model'
    | 'upstream_response_model_source'
    | 'model_match'
  >
> & { model?: string };

const modelName = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Compare recorded send/response names only. Legacy names and pricing are not evidence. */
export function usageModelObservation(record: ModelObservationRecord) {
  const requested = modelName(record.requested_model);
  const sent = modelName(record.upstream_model);
  const returned = modelName(record.upstream_response_model);
  const match: UsageModelMatch =
    !sent || !returned ? 'unknown' : sent === returned ? 'matched' : 'mismatch';
  const reportedSource = record.upstream_response_model_source;
  const source: UsageModelResponseSource | null =
    returned &&
    (reportedSource === 'header' || reportedSource === 'body' || reportedSource === 'metadata')
      ? reportedSource
      : null;

  return {
    primary: requested || modelName(record.alias) || modelName(record.model) || '—',
    requested,
    sent,
    returned,
    source,
    match,
    mapped: Boolean(requested && sent && requested !== sent),
  };
}

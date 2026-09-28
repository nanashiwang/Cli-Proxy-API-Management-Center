import { useTranslation } from 'react-i18next';
import type { UsageRecord } from '@/types/usage';
import { normalizeUsageDiagnostics } from './diagnostics';
import { formatDuration } from './analytics';
import styles from './UsagePage.module.scss';

export function UsageDiagnostics({ record }: { record: UsageRecord }) {
  const { t, i18n } = useTranslation();
  const data = normalizeUsageDiagnostics(record.diagnostics);
  if (!data) return <p className={styles.detailNote}>{t('usage_stats.diagnostic_availability')}</p>;
  return (
    <div>
      <p className={styles.detailNote}>{t('usage_stats.diagnostics.scope')}</p>
      <p className={styles.detailNote}>
        {t('usage_stats.diagnostics.captured', {
          time: new Date(data.captured_at).toLocaleString(i18n.language),
        })}
      </p>
      {data.truncated && (
        <p role="status" className={styles.detailNote}>
          {t('usage_stats.diagnostics.truncated')}
        </p>
      )}
      {data.attempts.map((attempt) => (
        <div key={attempt.sequence} className={styles.diagnosticAttempt}>
          <strong>
            #{attempt.sequence} · {t(`usage_stats.diagnostics.outcome.${attempt.outcome}`)}
            {attempt.status_code ? ` · ${attempt.status_code}` : ''}
          </strong>
          <p>
            {attempt.auth_id || attempt.provider || '—'} · {attempt.model || '—'}
          </p>
          <div className={styles.detailNote}>
            {t(`usage_stats.diagnostics.reason.${attempt.retry_reason}`)} ·{' '}
            {t(`usage_stats.diagnostics.phase.${attempt.phase}`)} · {attempt.transport || '—'} ·{' '}
            {formatDuration(
              attempt.ended_at
                ? Date.parse(attempt.ended_at) - Date.parse(attempt.started_at)
                : null
            )}{' '}
            · {t('usage_stats.ttft')}: {formatDuration(attempt.first_byte_ms)}
          </div>
          <ul className={styles.diagnosticEvents}>
            {data.events
              .filter((event) => event.attempt === attempt.sequence)
              .map((event, index) => (
                <li key={index}>
                  +{formatDuration(event.offset_ms)} ·{' '}
                  {t(`usage_stats.diagnostics.event.${event.kind}`)}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

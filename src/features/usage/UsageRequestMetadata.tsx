import { useTranslation } from 'react-i18next';
import { IconChevronDown } from '@/components/ui/icons';
import type { UsageRecord } from '@/types/usage';
import { usageRecordedText, usageTransportLabel } from './recordPresentation';
import styles from './UsagePage.module.scss';

export function UsageTransportBadge({
  value,
  direction,
}: {
  value: unknown;
  direction: 'upstream' | 'client';
}) {
  const { t } = useTranslation();
  const label = usageTransportLabel(value);
  return (
    <span
      className={styles.transportBadge}
      data-transport={label?.toLowerCase() || 'unknown'}
      title={t(`usage_stats.${direction}_transport_hint`)}
    >
      {label || t('usage_stats.not_recorded')}
    </span>
  );
}

export function UsageReasoningEffort({ value }: { value?: string }) {
  const { t } = useTranslation();
  const text = usageRecordedText(value);
  const state = text && ['default', 'auto', 'enabled', 'none'].includes(text) ? text : null;
  return (
    <span title={state ? t(`usage_stats.reasoning_hint_${state}`) : text || undefined}>
      {state ? t(`usage_stats.reasoning_${state}`) : text || t('usage_stats.not_recorded')}
    </span>
  );
}

/** Native details keeps long addresses and user agents readable on touch and keyboard. */
export function UsageExpandableValue({ value, label }: { value?: string; label: string }) {
  const { t } = useTranslation();
  const text = usageRecordedText(value);
  if (!text) return <span className={styles.muted}>{t('usage_stats.not_recorded')}</span>;
  return (
    <details className={styles.expandableValue}>
      <summary aria-label={t('usage_stats.expand_record_value', { field: label })} title={text}>
        <span>{text}</span>
        <IconChevronDown size={12} />
      </summary>
      <div>
        <code>{text}</code>
      </div>
    </details>
  );
}

export function UsageRequestMetadata({ record }: { record: UsageRecord }) {
  const { t } = useTranslation();
  return (
    <section className={styles.detailSection}>
      <h3>{t('usage_stats.request_metadata_title')}</h3>
      <div className={styles.detailFields}>
        <div className={styles.detailField}>
          <span>{t('usage_stats.reasoning_effort')}</span>
          <strong>
            <UsageReasoningEffort value={record.reasoning_effort} />
          </strong>
        </div>
        <div className={styles.detailField}>
          <span>{t('usage_stats.upstream_transport')}</span>
          <div>
            <UsageTransportBadge value={record.upstream_transport} direction="upstream" />
          </div>
        </div>
        <div className={styles.detailField}>
          <span>{t('usage_stats.client_transport')}</span>
          <div>
            <UsageTransportBadge value={record.client_transport} direction="client" />
          </div>
        </div>
        <div className={styles.detailField}>
          <span title={t('usage_stats.client_ip_hint')}>{t('usage_stats.client_ip')}</span>
          <strong>{usageRecordedText(record.client_ip) || t('usage_stats.not_recorded')}</strong>
        </div>
        <div className={`${styles.detailField} ${styles.fullWidthField}`}>
          <span>{t('usage_stats.user_agent')}</span>
          <strong>{usageRecordedText(record.user_agent) || t('usage_stats.not_recorded')}</strong>
        </div>
      </div>
      {record.executor_type === 'AIStudioExecutor' &&
        (record.upstream_transport === 'http' || record.upstream_transport === 'sse') && (
          <p className={styles.detailNote}>{t('usage_stats.aistudio_transport_note')}</p>
        )}
    </section>
  );
}

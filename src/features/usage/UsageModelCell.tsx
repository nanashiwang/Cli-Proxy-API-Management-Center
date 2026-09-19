import { useTranslation } from 'react-i18next';
import type { UsageRecord } from '@/types/usage';
import { usageModelObservation } from './modelObservation';
import styles from './UsagePage.module.scss';

export function UsageModelMatchBadge({ record }: { record: UsageRecord }) {
  const { t } = useTranslation();
  const { match, sent, returned } = usageModelObservation(record);
  const missingReport = Boolean(sent && !returned);
  return (
    <span
      className={styles.modelMatchBadge}
      data-match={match}
      title={t(
        missingReport
          ? 'usage_stats.model_match_hint_unreported'
          : `usage_stats.model_match_hint_${match}`
      )}
    >
      <i aria-hidden="true" />
      {t(missingReport ? 'usage_stats.model_not_reported' : `usage_stats.model_match_${match}`)}
    </span>
  );
}

/** Keep request aliases separate from the actual sent and returned model observations. */
export function UsageModelCell({ record }: { record: UsageRecord }) {
  const { t } = useTranslation();
  const model = usageModelObservation(record);
  return (
    <div className={styles.modelObservation}>
      <div className={styles.modelIdentity}>
        <strong title={`${t('usage_stats.requested_model')}: ${model.primary}`}>
          {model.primary}
        </strong>
        <UsageModelMatchBadge record={record} />
      </div>
      {model.sent || model.returned ? (
        <div className={styles.modelRoutes}>
          <div
            className={styles.modelRoute}
            title={`${t('usage_stats.sent_model')}: ${model.sent || t('usage_stats.not_recorded')}`}
          >
            <span className={styles.modelRouteLabel}>{t('usage_stats.sent_short')}</span>
            <code>{model.sent || '—'}</code>
            {model.mapped && (
              <span className={styles.modelMapping} title={t('usage_stats.model_mapping_hint')}>
                {t('usage_stats.model_mapped')}
              </span>
            )}
          </div>
          <div
            className={styles.modelRoute}
            data-route="returned"
            title={`${t('usage_stats.returned_model')}: ${model.returned || t('usage_stats.model_not_reported')}`}
          >
            <span className={styles.modelRouteLabel}>{t('usage_stats.returned_short')}</span>
            <code>{model.returned || t('usage_stats.model_not_reported')}</code>
          </div>
        </div>
      ) : (
        <span className={styles.modelMissing}>{t('usage_stats.model_observation_missing')}</span>
      )}
    </div>
  );
}

export function UsageModelDetails({ record }: { record: UsageRecord }) {
  const { t } = useTranslation();
  const model = usageModelObservation(record);
  return (
    <section className={styles.detailSection}>
      <div className={styles.modelDetailHeading}>
        <h3>{t('usage_stats.model_observation_title')}</h3>
        <UsageModelMatchBadge record={record} />
      </div>
      <div className={styles.detailFields}>
        <ModelField
          label={t('usage_stats.requested_model')}
          value={model.requested || t('usage_stats.not_recorded')}
        />
        <div className={styles.detailField}>
          <span>{t('usage_stats.sent_model')}</span>
          <strong>{model.sent || t('usage_stats.not_recorded')}</strong>
          {model.mapped && (
            <small className={styles.modelMappingNote}>{t('usage_stats.model_mapping_hint')}</small>
          )}
        </div>
        <ModelField
          label={t('usage_stats.returned_model')}
          value={model.returned || t('usage_stats.model_not_reported')}
        />
        <ModelField
          label={t('usage_stats.model_response_source')}
          value={
            model.source
              ? t(`usage_stats.model_source_${model.source}`)
              : t('usage_stats.not_recorded')
          }
        />
        <ModelField
          label={t('usage_stats.priced_model')}
          value={record.billing?.pricing?.matched_model || '—'}
        />
      </div>
      <p className={styles.detailNote}>
        {t(`usage_stats.model_match_hint_${model.match}`)} {t('usage_stats.model_observation_note')}
      </p>
    </section>
  );
}

function ModelField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailField}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { IconDownload, IconExternalLink } from '@/components/ui/icons';
import { logsApi } from '@/services/api/logs';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { downloadBlob } from '@/utils/download';
import type { UsageRecord } from '@/types/usage';
import { formatDuration, usageDiagnosticBundle, usageRecordAccount } from './analytics';
import { formatTokens, formatUSD } from './utils';
import styles from './UsagePage.module.scss';

export function UsageRecordModal({
  record,
  onClose,
}: {
  record: UsageRecord | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const [logLoading, setLogLoading] = useState(false);
  const exportDiagnostics = () => {
    if (!record) return;
    downloadBlob({
      filename: `usage-diagnostic-${record.id.slice(0, 16)}.json`,
      blob: new Blob([JSON.stringify(usageDiagnosticBundle(record), null, 2)], {
        type: 'application/json',
      }),
    });
  };
  const downloadLog = async () => {
    if (!record?.request_id) return;
    setLogLoading(true);
    try {
      const result = await logsApi.downloadRequestLogById(record.request_id);
      downloadBlob({
        filename: `request-${record.id.slice(0, 16)}.log`,
        blob: new Blob([result.data], { type: 'text/plain' }),
      });
    } catch (error) {
      showNotification(
        `${t('usage_stats.request_log_unavailable')}: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
    } finally {
      setLogLoading(false);
    }
  };
  const tokenRows = record
    ? [
        {
          label: t('usage_stats.input_tokens'),
          value: record.tokens.input_tokens,
          color: 'var(--usage-blue)',
        },
        {
          label: t('usage_stats.output_tokens'),
          value: record.tokens.output_tokens,
          color: 'var(--usage-green)',
        },
        {
          label: t('usage_stats.cache_read_tokens'),
          value: record.tokens.cache_read_tokens,
          color: 'var(--usage-orange)',
        },
        {
          label: t('usage_stats.cache_write_tokens'),
          value: record.tokens.cache_write_tokens,
          color: 'var(--usage-red)',
        },
        {
          label: t('usage_stats.reasoning_tokens'),
          value: record.tokens.reasoning_tokens,
          color: 'var(--usage-purple)',
        },
        {
          label: t('usage_stats.unclassified_tokens'),
          value: record.token_breakdown?.unclassified_tokens ?? null,
          color: 'var(--text-tertiary)',
        },
      ]
    : [];
  const tokenSum = tokenRows.reduce((sum, item) => sum + (item.value ?? 0), 0);
  let tokenOffset = 0;
  return (
    <Modal
      open={record != null}
      onClose={onClose}
      title={t('usage_stats.record_detail')}
      width={940}
      className={styles.detailModal}
      footer={
        <>
          <Button variant="secondary" onClick={exportDiagnostics}>
            <IconDownload size={15} /> {t('usage_stats.export_diagnostic')}
          </Button>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </>
      }
    >
      {record && (
        <div className={styles.detailContent}>
          <div className={styles.detailHero}>
            <div>
              <span className={record.failed ? styles.failed : styles.success}>
                {record.status_code || '—'} ·{' '}
                {t(record.failed ? 'usage_stats.failed' : 'usage_stats.succeeded')}
              </span>
              <h3>{record.model || record.alias || '—'}</h3>
              <p>
                {new Date(record.timestamp).toLocaleString()} · {record.provider}
              </p>
            </div>
            <div>
              <span>{t('usage_stats.cost')}</span>
              <strong>
                {record.billing?.priced
                  ? `${record.billing.pricing?.estimated ? '≈ ' : ''}${formatUSD(record.cost_usd ?? record.billing.total_usd)}`
                  : t('usage_stats.unpriced')}
              </strong>
            </div>
          </div>
          <div className={styles.detailStats}>
            <Field
              label={t('usage_stats.latency')}
              value={formatDuration(record.latency_ms || null)}
            />
            <Field label={t('usage_stats.ttft')} value={formatDuration(record.ttft_ms || null)} />
            <Field
              label={t('usage_stats.total_tokens')}
              value={record.tokens.total_tokens.toLocaleString()}
            />
            <Field
              label={t('usage_stats.service_tier')}
              value={record.response_service_tier || record.service_tier || '—'}
            />
          </div>
          <section className={styles.detailSection}>
            <h3>{t('usage_stats.routing_identity')}</h3>
            <div className={styles.detailFields}>
              <Field
                label={t('usage_stats.request_id')}
                value={record.request_id || t('usage_stats.not_recorded')}
              />
              <Field label={t('usage_stats.account')} value={usageRecordAccount(record)} />
              <Field label={t('usage_stats.endpoint')} value={record.endpoint || '—'} />
              <Field label={t('usage_stats.executor')} value={record.executor_type || '—'} />
              <Field
                label={t('usage_stats.requested_model')}
                value={record.alias || record.model || '—'}
              />
              <Field
                label={t('usage_stats.priced_model')}
                value={record.billing?.pricing?.matched_model || '—'}
              />
              <Field label={t('usage_stats.auth_type')} value={record.auth_type || '—'} />
              <Field
                label={t('usage_stats.record_kind')}
                value={t(record.generate ? 'usage_stats.generation' : 'usage_stats.warmup')}
              />
            </div>
          </section>
          <div className={styles.detailGrid}>
            <section className={styles.detailSection}>
              <h3>{t('usage_stats.token_breakdown')}</h3>
              <div className={styles.tokenComposition}>
                <div className={styles.donut}>
                  <svg viewBox="0 0 120 120" aria-hidden="true">
                    <circle cx="60" cy="60" r="47" className={styles.donutTrack} />
                    {record.token_breakdown &&
                      tokenRows.map((item) => {
                        const length = tokenSum ? ((item.value ?? 0) / tokenSum) * 295.31 : 0;
                        const offset = tokenOffset;
                        tokenOffset += length;
                        return (
                          <circle
                            key={item.label}
                            cx="60"
                            cy="60"
                            r="47"
                            fill="none"
                            stroke={item.color}
                            strokeWidth="10"
                            strokeDasharray={`${length} ${295.31 - length}`}
                            strokeDashoffset={-offset}
                            transform="rotate(-90 60 60)"
                          />
                        );
                      })}
                  </svg>
                  <div>
                    <span>{t('usage_stats.total_tokens')}</span>
                    <strong>{formatTokens(record.tokens.total_tokens)}</strong>
                  </div>
                </div>
                <dl className={styles.tokenLegend}>
                  {tokenRows.map((item) => (
                    <div key={item.label}>
                      <dt>
                        <i style={{ background: item.color }} />
                        {item.label}
                      </dt>
                      <dd>{item.value == null ? '—' : item.value.toLocaleString()}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <p className={styles.detailNote}>
                {t(`usage_stats.quality_${record.token_breakdown?.quality ?? 'unavailable'}`)}
              </p>
            </section>
            <section className={styles.detailSection}>
              <h3>{t('usage_stats.billing_breakdown')}</h3>
              <div className={styles.detailFields}>
                {(['input', 'output', 'cache_read', 'cache_write'] as const).map((key) => (
                  <Field
                    key={key}
                    label={t(`usage_stats.${key}_tokens`)}
                    value={
                      record.billing?.priced
                        ? formatUSD(record.billing.breakdown[`${key}_usd`])
                        : '—'
                    }
                  />
                ))}
                <Field
                  label={t('usage_stats.pricing_source')}
                  value={record.billing?.pricing?.source || '—'}
                />
                <Field
                  label={t('usage_stats.pricing_version')}
                  value={record.billing?.pricing?.version || '—'}
                />
              </div>
              {!record.billing?.priced && (
                <p className={styles.detailNote}>
                  {record.billing?.reason || t('usage_stats.unpriced')}
                </p>
              )}
            </section>
          </div>
          <section className={styles.detailSection}>
            <h3>{t('usage_stats.diagnostic_title')}</h3>
            <p className={styles.detailNote}>{t('usage_stats.diagnostic_availability')}</p>
            <div className={styles.detailActions}>
              {record.request_id ? (
                <>
                  <Link
                    to={`/logs?request_id=${encodeURIComponent(record.request_id)}`}
                    className="btn btn-secondary"
                    onClick={onClose}
                  >
                    <IconExternalLink size={15} />
                    {t('usage_stats.open_logs')}
                  </Link>
                  <Button
                    variant="secondary"
                    loading={logLoading}
                    onClick={() => void downloadLog()}
                  >
                    {t('usage_stats.download_request_log')}
                  </Button>
                </>
              ) : (
                <span className={styles.muted}>{t('usage_stats.request_id_missing')}</span>
              )}
            </div>
            <p className={styles.detailNote}>{t('usage_stats.diagnostic_export_note')}</p>
          </section>
        </div>
      )}
    </Modal>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailField}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

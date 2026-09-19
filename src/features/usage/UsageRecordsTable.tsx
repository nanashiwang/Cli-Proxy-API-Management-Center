import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconEye } from '@/components/ui/icons';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { UsageRecord, UsageSort } from '@/types/usage';
import { formatDuration, usageRecordAccount } from './analytics';
import { formatUSD } from './utils';
import { UsageTokenCell } from './UsageTokenCell';
import { UsageModelCell } from './UsageModelCell';
import {
  USAGE_RECORD_COLUMNS,
  USAGE_RECORD_COLUMN_WIDTHS,
  usageRecordedText,
} from './recordPresentation';
import styles from './UsagePage.module.scss';
import { UsageExpandableValue, UsageTransportBadge } from './UsageRequestMetadata';

export function UsageRecordsTable({
  records,
  loading,
  sort,
  order,
  onSort,
  onViewDetail,
  emptyContent,
}: {
  records: UsageRecord[];
  loading: boolean;
  sort: UsageSort;
  order: 'asc' | 'desc';
  onSort: (sort: UsageSort) => void;
  onViewDetail: (record: UsageRecord) => void;
  emptyContent: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const sortState = (value: UsageSort) =>
    sort === value ? (order === 'desc' ? 'descending' : 'ascending') : 'none';
  const sortButton = (value: UsageSort, label: string) => (
    <button
      type="button"
      className={styles.sortButton}
      onClick={() => onSort(value)}
      aria-label={t('usage_stats.sort_record_column', { column: label })}
      aria-pressed={sort === value}
    >
      {label}
      <span aria-hidden="true">{sort === value ? (order === 'desc' ? '↓' : '↑') : '↕'}</span>
    </button>
  );
  return (
    <>
      <p className={styles.tableScrollHint}>{t('usage_stats.records_scroll_hint')}</p>
      <div
        className={`${styles.tableWrap} ${styles.recordsTableWrap}`}
        aria-busy={loading}
        tabIndex={0}
        role="region"
        aria-label={t('usage_stats.records_title')}
      >
        <table className={styles.recordsTable}>
          <colgroup>
            {USAGE_RECORD_COLUMNS.map((column) => (
              <col key={column} style={{ width: USAGE_RECORD_COLUMN_WIDTHS[column] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {USAGE_RECORD_COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className={column === 'actions' ? styles.recordActionsColumn : undefined}
                  aria-sort={
                    column === 'tokens'
                      ? sortState('tokens')
                      : column === 'cost'
                        ? sortState('cost')
                        : column === 'time'
                          ? sortState('timestamp')
                          : column === 'request_latency' && (sort === 'latency' || sort === 'ttft')
                            ? sortState(sort)
                            : undefined
                  }
                >
                  {column === 'tokens' ? (
                    sortButton('tokens', t('usage_stats.tokens'))
                  ) : column === 'cost' ? (
                    sortButton('cost', t('usage_stats.cost'))
                  ) : column === 'time' ? (
                    sortButton('timestamp', t('usage_stats.time'))
                  ) : column === 'request_latency' ? (
                    <div className={styles.latencyHeader}>
                      <span>{t('usage_stats.request_latency')}</span>
                      <div>
                        {sortButton('latency', t('usage_stats.latency'))}
                        {sortButton('ttft', t('usage_stats.ttft'))}
                      </div>
                    </div>
                  ) : (
                    <span
                      title={
                        column === 'upstream_transport'
                          ? t('usage_stats.upstream_transport_hint')
                          : column === 'client_transport'
                            ? t('usage_stats.client_transport_hint')
                            : column === 'client_ip'
                              ? t('usage_stats.client_ip_hint')
                              : undefined
                      }
                    >
                      {t(`usage_stats.${column}`)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading &&
              records.map((row) => (
                <tr key={row.id}>
                  <td className={styles.accountCell}>
                    <strong title={usageRecordAccount(row)}>{usageRecordAccount(row)}</strong>
                    <div className={styles.recordStatus}>
                      <span
                        className={row.failed ? styles.failed : styles.success}
                        title={t('usage_stats.status')}
                      >
                        {row.status_code ||
                          t(row.failed ? 'usage_stats.failed' : 'usage_stats.succeeded')}
                      </span>
                      {!row.generate && (
                        <span className={styles.muted}>{t('usage_stats.warmup')}</span>
                      )}
                    </div>
                  </td>
                  <td className={styles.providerTypeCell}>
                    <strong>
                      {usageRecordedText(row.provider) || t('usage_stats.not_recorded')}
                    </strong>
                    <small>
                      {usageRecordedText(row.auth_type) || t('usage_stats.not_recorded')}
                    </small>
                  </td>
                  <td className={styles.modelCell}>
                    <UsageModelCell record={row} />
                  </td>
                  <td className={styles.reasoningCell}>
                    <span title={row.reasoning_effort}>
                      {usageRecordedText(row.reasoning_effort) || t('usage_stats.not_recorded')}
                    </span>
                  </td>
                  <td className={styles.endpointCell}>
                    <code title={row.endpoint}>
                      {usageRecordedText(row.endpoint) || t('usage_stats.not_recorded')}
                    </code>
                  </td>
                  <td>
                    <UsageTransportBadge value={row.upstream_transport} direction="upstream" />
                  </td>
                  <td>
                    <UsageTransportBadge value={row.client_transport} direction="client" />
                  </td>
                  <td className={styles.tokensCell}>
                    <UsageTokenCell record={row} />
                  </td>
                  <td>
                    <strong className={styles.costValue}>
                      {row.billing?.priced
                        ? `${row.billing.pricing?.estimated ? '≈ ' : ''}${formatUSD(row.cost_usd ?? row.billing.total_usd)}`
                        : '—'}
                    </strong>
                    {!row.billing?.priced && <small>{t('usage_stats.unpriced')}</small>}
                  </td>
                  <td className={`${styles.numeric} ${styles.latencyCell}`}>
                    <strong>{formatDuration(row.latency_ms || null)}</strong>
                    <small>
                      {t('usage_stats.ttft')}: {formatDuration(row.ttft_ms || null)}
                    </small>
                  </td>
                  <td className={styles.timeCell}>
                    <strong>
                      {new Date(row.timestamp).toLocaleTimeString(i18n.language, { hour12: false })}
                    </strong>
                    <small>{new Date(row.timestamp).toLocaleDateString(i18n.language)}</small>
                  </td>
                  <td className={styles.clientIpCell}>
                    <UsageExpandableValue
                      value={row.client_ip}
                      label={t('usage_stats.client_ip')}
                    />
                  </td>
                  <td className={styles.userAgentCell}>
                    <UsageExpandableValue
                      value={row.user_agent}
                      label={t('usage_stats.user_agent')}
                    />
                  </td>
                  <td className={styles.recordActionsColumn}>
                    <button
                      type="button"
                      className={styles.recordDetailAction}
                      onClick={() => onViewDetail(row)}
                      aria-label={t('usage_stats.view_detail')}
                    >
                      <IconEye size={15} />
                      <span>{t('usage_stats.details_action')}</span>
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {(loading || !records.length) && (
        <div className={`${styles.empty} ${styles.recordsTableEmpty}`} role="status">
          {loading ? (
            <>
              <LoadingSpinner size={24} />
              <span>{t('common.loading')}</span>
            </>
          ) : (
            emptyContent
          )}
        </div>
      )}
    </>
  );
}

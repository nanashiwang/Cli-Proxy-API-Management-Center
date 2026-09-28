import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconEye } from '@/components/ui/icons';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { UsageRecord, UsageSort } from '@/types/usage';
import { formatDuration, usageRecordAccount } from './analytics';
import { UsageCostCell } from './UsageCostCell';
import { UsageTokenCell } from './UsageTokenCell';
import { UsageModelCell } from './UsageModelCell';
import {
  type UsageRecordColumn,
  USAGE_RECORD_COLUMN_WIDTHS,
  usageRecordedText,
} from './recordPresentation';
import styles from './UsagePage.module.scss';
import { UsageColumnSettings } from './UsageColumnSettings';
import {
  readColumnPreferences,
  visibleRecordColumns,
  USAGE_COLUMNS_STORAGE_KEY,
  type ColumnPreferences,
} from './columnPreferences';
import {
  UsageExpandableValue,
  UsageTransportBadge,
  UsageReasoningEffort,
} from './UsageRequestMetadata';

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
  const [preferences, setPreferences] = useState(readColumnPreferences);
  const columns = visibleRecordColumns(preferences);
  const updatePreferences = (value: ColumnPreferences) => {
    setPreferences(value);
    try {
      localStorage.setItem(USAGE_COLUMNS_STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* In-memory settings still work when storage is unavailable. */
    }
  };
  const pinnedStyle = (column: UsageRecordColumn): CSSProperties | undefined =>
    preferences.pinned.includes(column)
      ? {
          left: columns
            .slice(0, columns.indexOf(column))
            .reduce((total, key) => total + USAGE_RECORD_COLUMN_WIDTHS[key], 0),
        }
      : undefined;
  const columnClass = (column: UsageRecordColumn, existing = '') =>
    [
      existing,
      column === 'actions' ? styles.recordActionsColumn : '',
      preferences.pinned.includes(column) ? styles.recordPinnedColumn : '',
    ]
      .filter(Boolean)
      .join(' ');
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
  const renderCell = (row: UsageRecord, column: UsageRecordColumn) => {
    switch (column) {
      case 'account':
        return (
          <td
            key={column}
            className={columnClass(column, styles.accountCell)}
            style={pinnedStyle(column)}
          >
            <strong title={usageRecordAccount(row)}>{usageRecordAccount(row)}</strong>
            <div className={styles.recordStatus}>
              <span
                className={row.failed ? styles.failed : styles.success}
                title={t('usage_stats.status')}
              >
                {row.status_code || t(row.failed ? 'usage_stats.failed' : 'usage_stats.succeeded')}
              </span>
              {!row.generate && <span className={styles.muted}>{t('usage_stats.warmup')}</span>}
            </div>
          </td>
        );
      case 'provider_type':
        return (
          <td
            key={column}
            className={columnClass(column, styles.providerTypeCell)}
            style={pinnedStyle(column)}
          >
            <strong>{usageRecordedText(row.provider) || t('usage_stats.not_recorded')}</strong>
            <small>{usageRecordedText(row.auth_type) || t('usage_stats.not_recorded')}</small>
          </td>
        );
      case 'model':
        return (
          <td
            key={column}
            className={columnClass(column, styles.modelCell)}
            style={pinnedStyle(column)}
          >
            <UsageModelCell record={row} />
          </td>
        );
      case 'reasoning_effort':
        return (
          <td
            key={column}
            className={columnClass(column, styles.reasoningCell)}
            style={pinnedStyle(column)}
          >
            <UsageReasoningEffort value={row.reasoning_effort} />
          </td>
        );
      case 'endpoint':
        return (
          <td
            key={column}
            className={columnClass(column, styles.endpointCell)}
            style={pinnedStyle(column)}
          >
            <code title={row.endpoint}>
              {usageRecordedText(row.endpoint) || t('usage_stats.not_recorded')}
            </code>
          </td>
        );
      case 'upstream_transport':
        return (
          <td key={column} className={columnClass(column, '')} style={pinnedStyle(column)}>
            <UsageTransportBadge value={row.upstream_transport} direction="upstream" />
          </td>
        );
      case 'client_transport':
        return (
          <td key={column} className={columnClass(column, '')} style={pinnedStyle(column)}>
            <UsageTransportBadge value={row.client_transport} direction="client" />
          </td>
        );
      case 'tokens':
        return (
          <td
            key={column}
            className={columnClass(column, styles.tokensCell)}
            style={pinnedStyle(column)}
          >
            <UsageTokenCell record={row} />
          </td>
        );
      case 'cost':
        return (
          <td key={column} className={columnClass(column, '')} style={pinnedStyle(column)}>
            <UsageCostCell record={row} />
          </td>
        );
      case 'request_latency':
        return (
          <td
            key={column}
            className={columnClass(column, `${styles.numeric} ${styles.latencyCell}`)}
            style={pinnedStyle(column)}
          >
            <strong>{formatDuration(row.latency_ms || null)}</strong>
            <small>
              {t('usage_stats.ttft')}: {formatDuration(row.ttft_ms || null)}
            </small>
          </td>
        );
      case 'time':
        return (
          <td
            key={column}
            className={columnClass(column, styles.timeCell)}
            style={pinnedStyle(column)}
          >
            <strong>
              {new Date(row.timestamp).toLocaleTimeString(i18n.language, { hour12: false })}
            </strong>
            <small>{new Date(row.timestamp).toLocaleDateString(i18n.language)}</small>
          </td>
        );
      case 'client_ip':
        return (
          <td
            key={column}
            className={columnClass(column, styles.clientIpCell)}
            style={pinnedStyle(column)}
          >
            <UsageExpandableValue value={row.client_ip} label={t('usage_stats.client_ip')} />
          </td>
        );
      case 'user_agent':
        return (
          <td
            key={column}
            className={columnClass(column, styles.userAgentCell)}
            style={pinnedStyle(column)}
          >
            <UsageExpandableValue value={row.user_agent} label={t('usage_stats.user_agent')} />
          </td>
        );
      case 'actions':
        return (
          <td key={column} className={columnClass(column, '')} style={pinnedStyle(column)}>
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
        );
    }
  };
  return (
    <>
      <UsageColumnSettings value={preferences} onChange={updatePreferences} />
      <p className={styles.tableScrollHint}>{t('usage_stats.records_scroll_hint')}</p>
      <div
        className={`${styles.tableWrap} ${styles.recordsTableWrap}`}
        aria-busy={loading}
        tabIndex={0}
        role="region"
        aria-label={t('usage_stats.records_title')}
      >
        <table
          className={styles.recordsTable}
          style={{
            width: columns.reduce((total, key) => total + USAGE_RECORD_COLUMN_WIDTHS[key], 0),
          }}
        >
          <colgroup>
            {columns.map((column) => (
              <col key={column} style={{ width: USAGE_RECORD_COLUMN_WIDTHS[column] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className={columnClass(column)}
                  style={pinnedStyle(column)}
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
                <tr key={row.id}>{columns.map((column) => renderCell(row, column))}</tr>
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

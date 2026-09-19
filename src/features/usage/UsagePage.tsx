import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import {
  IconFileText,
  IconTimer,
  IconRefreshCw,
  IconSettings,
  IconSearch,
  IconSidebarUsage,
  IconInbox,
  IconEye,
  IconChevronLeft,
} from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { usageApi } from '@/services/api/usage';
import type {
  UsageDashboard,
  UsageFilters,
  UsageOption,
  UsageRange,
  UsageRecord,
  UsageRecordsResponse,
  UsageSort,
} from '@/types/usage';
import { formatTokens, formatUSD } from './utils';
import {
  customRangeFilters,
  formatDuration,
  formatRate,
  usageTimeFilters,
  usageEndpointUnavailable,
  usageRecordAccount,
} from './analytics';
import { Segments, UsageInsights } from './UsageInsights';
import { UsageManagement } from './UsageManagement';
import { UsageRecordModal } from './UsageRecordModal';
import { UsageModelCell } from './UsageModelCell';
import styles from './UsagePage.module.scss';

type DimensionFilters = Pick<
  UsageFilters,
  'provider' | 'model' | 'account' | 'api_key' | 'pool' | 'status' | 'include_warmup'
>;
const emptyRecords: UsageRecordsResponse = {
  items: [],
  page: 1,
  page_size: 25,
  total: 0,
  total_pages: 0,
};
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function UsagePage() {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<UsageRange | 'custom'>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filters, setFilters] = useState<DimensionFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<UsageSort>('timestamp');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [snapshotAt, setSnapshotAt] = useState(() => new Date());
  const [data, setData] = useState<UsageDashboard | null>(null);
  const [records, setRecords] = useState<UsageRecordsResponse>(emptyRecords);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [error, setError] = useState('');
  const [recordsError, setRecordsError] = useState('');
  const [unsupported, setUnsupported] = useState(false);
  const [loadedRecordsQuery, setLoadedRecordsQuery] = useState('');
  const [managementOpen, setManagementOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<UsageRecord | null>(null);
  const activeQuery = useRef('');
  const [loadedQuery, setLoadedQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const customTime = useMemo(
    () => customRangeFilters(customFrom, customTo),
    [customFrom, customTo]
  );
  const query = useMemo<UsageFilters | null>(() => {
    const time = usageTimeFilters(range, snapshotAt, customTime);
    return time ? { ...filters, search: search || undefined, ...time } : null;
  }, [range, customTime, snapshotAt, filters, search]);
  const queryKey = JSON.stringify(query);
  const refreshing = loading || recordsLoading;
  const recordsQueryKey = JSON.stringify({ query, page, pageSize, sort, order });

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    activeQuery.current = queryKey;
    setLoading(true);
    setError('');
    setUnsupported(false);
    void usageApi
      .getDashboard(query, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setLoadedQuery(queryKey);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(errorText(err));
          if (usageEndpointUnavailable(err)) setUnsupported(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, queryKey]);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    setRecordsLoading(true);
    setRecordsError('');
    void usageApi
      .getRecords({ ...query, page, page_size: pageSize, sort, order }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (page > Math.max(1, result.total_pages)) {
          setRecords(result);
          setPage(Math.max(1, result.total_pages));
          return;
        }
        setRecords(result);
        setLoadedRecordsQuery(recordsQueryKey);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setRecordsError(errorText(err));
          if (usageEndpointUnavailable(err)) setUnsupported(true);
          setRecords(emptyRecords);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecordsLoading(false);
      });
    return () => controller.abort();
  }, [query, page, pageSize, sort, order, recordsQueryKey]);

  const refresh = useCallback(async () => {
    setSnapshotAt(new Date());
  }, []);
  useHeaderRefresh(refresh);
  const changeFilter = (key: keyof DimensionFilters, value: string | boolean) => {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters({});
    setSearchInput('');
    setSearch('');
    setPage(1);
  };
  const filterCount = Object.values(filters).filter(Boolean).length + (search ? 1 : 0);
  const options = (values: UsageOption[] | undefined, key: string): UsageOption[] => [
    { value: '', label: t(`usage_stats.all_${key}`) },
    ...(values ?? []),
  ];
  const formatCount = (value: number) => value.toLocaleString(i18n.language);
  const currentData = data && loadedQuery === queryKey ? data : null;
  const summary = currentData?.summary;
  const metric = (value: number | undefined) => (value == null ? '—' : formatCount(value));
  const activeFilterLabels = Object.entries(filters)
    .filter(([, value]) => value && value !== true)
    .map(([key, value]) => {
      const optionKey =
        key === 'provider'
          ? 'providers'
          : key === 'model'
            ? 'models'
            : key === 'account'
              ? 'accounts'
              : key === 'api_key'
                ? 'api_keys'
                : key === 'pool'
                  ? 'pools'
                  : null;
      return {
        key,
        label:
          key === 'status'
            ? t(`usage_stats.${value === 'failed' ? 'failed' : 'succeeded'}`)
            : (optionKey
                ? data?.filters[optionKey].find((option) => option.value === value)?.label
                : null) || String(value),
      };
    });
  const canShowRecords =
    !!query && !recordsLoading && !recordsError && loadedRecordsQuery === recordsQueryKey;
  const sortBy = (next: UsageSort) => {
    if (sort === next) setOrder((value) => (value === 'desc' ? 'asc' : 'desc'));
    else {
      setSort(next);
      setOrder('desc');
    }
    setPage(1);
  };
  const sortHeader = (value: UsageSort, label: string) => (
    <button className={styles.sortButton} onClick={() => sortBy(value)}>
      {label}
      <span aria-hidden="true">{sort === value ? (order === 'desc' ? '↓' : '↑') : '↕'}</span>
    </button>
  );
  const showRecord = async (row: UsageRecord) => {
    setSelectedRecord(row);
    const currentKey = activeQuery.current;
    try {
      const detail = await usageApi.getRecord(row.id);
      if (activeQuery.current === currentKey)
        setSelectedRecord((current) => (current?.id === row.id ? detail : current));
    } catch {
      /* The selected page already contains the persisted record. */
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>{t('usage_stats.title')}</h1>
          <p>{t('usage_stats.dashboard_subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <Select
            value={range}
            onChange={(value) => {
              setRange(value as UsageRange | 'custom');
              setPage(1);
              setSnapshotAt(new Date());
            }}
            ariaLabel={t('usage_stats.range_label')}
            options={['24h', '7d', '30d', 'all', 'custom'].map((value) => ({
              value,
              label: t(`usage_stats.range_${value}`),
            }))}
          />
          <Button
            variant="secondary"
            onClick={() => void refresh()}
            disabled={!query}
            loading={refreshing && !!query}
            aria-label={t('common.refresh')}
          >
            <IconRefreshCw size={16} />
          </Button>
          <Button variant="secondary" onClick={() => setManagementOpen(true)}>
            <IconSettings size={16} />
            {t('usage_stats.manage')}
          </Button>
        </div>
      </header>
      <section className={styles.filterPanel} aria-label={t('usage_stats.filters')}>
        {range === 'custom' && (
          <div className={styles.customRange}>
            <label>
              {t('usage_stats.from')}
              <input
                type="datetime-local"
                value={customFrom}
                onChange={(event) => {
                  setCustomFrom(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              {t('usage_stats.to')}
              <input
                type="datetime-local"
                value={customTo}
                onChange={(event) => {
                  setCustomTo(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            {!customTime && <span role="status">{t('usage_stats.invalid_range')}</span>}
          </div>
        )}
        <div className={styles.filters}>
          {(['provider', 'model', 'account', 'api_key', 'pool'] as const).map((key) => (
            <Select
              key={key}
              value={filters[key] || ''}
              ariaLabel={t(`usage_stats.filter_${key}`)}
              options={options(
                data?.filters[
                  key === 'provider'
                    ? 'providers'
                    : key === 'model'
                      ? 'models'
                      : key === 'account'
                        ? 'accounts'
                        : key === 'api_key'
                          ? 'api_keys'
                          : 'pools'
                ],
                key
              )}
              onChange={(value) => changeFilter(key, value)}
              size="sm"
            />
          ))}
          <label className={styles.warmupToggle}>
            <input
              type="checkbox"
              checked={!!filters.include_warmup}
              onChange={(event) => changeFilter('include_warmup', event.target.checked)}
            />
            {t('usage_stats.include_warmup')}
          </label>
          {filterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              {t('usage_stats.reset_filters')}
            </Button>
          )}
        </div>
        {activeFilterLabels.length > 0 && (
          <div className={styles.filterChips}>
            {activeFilterLabels.map((item) => (
              <button
                key={item.key}
                onClick={() => changeFilter(item.key as keyof DimensionFilters, '')}
              >
                {item.label}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
      </section>
      {unsupported && (
        <div className={styles.errorBanner} role="alert">
          <strong>{t('usage_stats.backend_upgrade_required')}</strong>
          <Link to="/system">{t('usage_stats.open_system')}</Link>
        </div>
      )}
      {error && !unsupported && (
        <div className={styles.errorBanner} role="alert">
          <strong>{t('usage_stats.load_failed')}</strong>
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={() => void refresh()}>
            {t('common.refresh')}
          </Button>
        </div>
      )}
      {data?.storage.last_error && (
        <div className={styles.errorBanner} role="alert">
          {data.storage.last_error}
        </div>
      )}
      <section className={styles.metrics} aria-busy={loading && !!query}>
        <MetricCard
          label={t('usage_stats.total_requests')}
          value={metric(summary?.total_requests)}
          detail={
            summary
              ? t('usage_stats.success_failure_count', {
                  success: formatCount(summary.success_count),
                  failed: formatCount(summary.failure_count),
                })
              : t('usage_stats.filtered_range')
          }
          tone="blue"
          icon={<IconSidebarUsage size={19} />}
        />
        <MetricCard
          label={t('usage_stats.total_tokens')}
          value={summary ? formatTokens(summary.total_tokens) : '—'}
          detail={
            summary
              ? t('usage_stats.input_output', {
                  input: formatTokens(
                    summary.tokens.input_tokens +
                      summary.tokens.cache_read_tokens +
                      summary.tokens.cache_write_tokens
                  ),
                  output: formatTokens(
                    summary.tokens.output_tokens + summary.tokens.reasoning_tokens
                  ),
                })
              : t('usage_stats.filtered_range')
          }
          tone="green"
          icon={<IconFileText size={19} />}
        />
        <MetricCard
          label={t('usage_stats.cached_tokens')}
          value={summary ? formatTokens(summary.tokens.cache_read_tokens) : '—'}
          detail={
            currentData
              ? `${t('usage_stats.cache_read_ratio')} ${formatRate(currentData.cost.cache_read_ratio)}`
              : t('usage_stats.cache_read_tokens')
          }
          tone="orange"
          icon={<IconInbox size={19} />}
        />
        <MetricCard
          label={t('usage_stats.avg_latency')}
          value={formatDuration(summary?.avg_latency_ms)}
          detail={`${t('usage_stats.ttft')} ${formatDuration(summary?.avg_ttft_ms)}`}
          tone="cyan"
          icon={<IconTimer size={19} />}
        />
      </section>
      {summary?.cache_write_unreported && (
        <div className={styles.warningBanner}>{t('usage_stats.cache_write_unreported')}</div>
      )}
      {query && !currentData && !error ? (
        <div className={styles.loading}>
          <LoadingSpinner size={28} />
          <span>{t('usage_stats.loading_analytics')}</span>
        </div>
      ) : currentData ? (
        <UsageInsights data={currentData} onDimension={(key, value) => changeFilter(key, value)} />
      ) : null}
      <article className={styles.recordsPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{t('usage_stats.records_title')}</h2>
            <p>{t('usage_stats.records_description')}</p>
          </div>
          <Segments
            value={filters.status || 'all'}
            label={t('usage_stats.record_status')}
            onChange={(value) => changeFilter('status', value === 'all' ? '' : value)}
            options={[
              { value: 'all', label: t('usage_stats.all_records') },
              { value: 'success', label: t('usage_stats.success_records') },
              { value: 'failed', label: t('usage_stats.failed_records') },
            ]}
          />
        </div>
        <div className={styles.recordsToolbar}>
          <label className={styles.search}>
            <IconSearch size={17} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('usage_stats.search_placeholder')}
              aria-label={t('usage_stats.search_placeholder')}
            />
          </label>
          <span>
            {t('usage_stats.matching_records', { count: canShowRecords ? records.total : 0 })}
          </span>
        </div>
        {recordsError && !unsupported && (
          <div role="alert" className={styles.errorBanner}>
            {recordsError}
          </div>
        )}
        <div className={styles.tableWrap} aria-busy={recordsLoading && !!query}>
          <table className={styles.recordsTable}>
            <thead>
              <tr>
                <th
                  aria-sort={
                    sort === 'timestamp' ? (order === 'desc' ? 'descending' : 'ascending') : 'none'
                  }
                >
                  {sortHeader('timestamp', t('usage_stats.time'))}
                </th>
                <th>{t('usage_stats.account')}</th>
                <th>{t('usage_stats.model')}</th>
                <th>{t('usage_stats.status')}</th>
                <th
                  aria-sort={
                    sort === 'tokens' ? (order === 'desc' ? 'descending' : 'ascending') : 'none'
                  }
                >
                  {sortHeader('tokens', t('usage_stats.tokens'))}
                </th>
                <th
                  aria-sort={
                    sort === 'cost' ? (order === 'desc' ? 'descending' : 'ascending') : 'none'
                  }
                >
                  {sortHeader('cost', t('usage_stats.cost'))}
                </th>
                <th
                  aria-sort={
                    sort === 'latency' ? (order === 'desc' ? 'descending' : 'ascending') : 'none'
                  }
                >
                  {sortHeader('latency', t('usage_stats.latency'))}
                </th>
                <th
                  aria-sort={
                    sort === 'ttft' ? (order === 'desc' ? 'descending' : 'ascending') : 'none'
                  }
                >
                  {sortHeader('ttft', t('usage_stats.ttft'))}
                </th>
                <th>
                  <span className={styles.srOnly}>{t('usage_stats.view_detail')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {recordsLoading && query ? (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    <LoadingSpinner size={24} />
                  </td>
                </tr>
              ) : !canShowRecords || !records.items.length ? (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    <IconInbox size={32} />
                    <strong>
                      {t(
                        unsupported
                          ? 'usage_stats.backend_upgrade_required'
                          : recordsError
                            ? 'usage_stats.load_failed'
                            : 'usage_stats.no_matching_records'
                      )}
                    </strong>
                    {!unsupported && !recordsError && (
                      <span>{t('usage_stats.no_matching_hint')}</span>
                    )}
                    {filterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={resetFilters}>
                        {t('usage_stats.reset_filters')}
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                records.items.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.timeCell}>
                      <strong>
                        {new Date(row.timestamp).toLocaleTimeString(i18n.language, {
                          hour12: false,
                        })}
                      </strong>
                      <small>{new Date(row.timestamp).toLocaleDateString(i18n.language)}</small>
                    </td>
                    <td className={styles.accountCell}>
                      <strong title={row.account}>{usageRecordAccount(row)}</strong>
                      <small>
                        {row.provider} · {row.auth_type || '—'}
                      </small>
                    </td>
                    <td className={styles.modelCell}>
                      <UsageModelCell record={row} />
                      <small title={row.endpoint}>
                        {row.endpoint || row.service_tier || '—'}
                        {!row.generate ? ` · ${t('usage_stats.warmup')}` : ''}
                      </small>
                    </td>
                    <td>
                      <span className={row.failed ? styles.failed : styles.success}>
                        {row.status_code ||
                          t(row.failed ? 'usage_stats.failed' : 'usage_stats.succeeded')}
                      </span>
                    </td>
                    <td>
                      <strong>{formatTokens(row.tokens.total_tokens)}</strong>
                      <small>
                        {t('usage_stats.token_short', {
                          input: formatTokens(row.tokens.input_tokens),
                          output: formatTokens(row.tokens.output_tokens),
                          cache: formatTokens(row.tokens.cache_read_tokens),
                        })}
                      </small>
                    </td>
                    <td>
                      <strong className={styles.costValue}>
                        {row.billing?.priced
                          ? `${row.billing.pricing?.estimated ? '≈ ' : ''}${formatUSD(row.cost_usd ?? row.billing.total_usd)}`
                          : '—'}
                      </strong>
                      {!row.billing?.priced && <small>{t('usage_stats.unpriced')}</small>}
                    </td>
                    <td className={styles.numeric}>{formatDuration(row.latency_ms || null)}</td>
                    <td className={styles.numeric}>{formatDuration(row.ttft_ms || null)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.detailButton}
                        onClick={() => void showRecord(row)}
                        aria-label={t('usage_stats.view_detail')}
                        title={t('usage_stats.view_detail')}
                      >
                        <IconEye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <span>
            {t('usage_stats.pagination_summary', {
              from:
                canShowRecords && records.total ? (records.page - 1) * records.page_size + 1 : 0,
              to: canShowRecords ? Math.min(records.page * records.page_size, records.total) : 0,
              total: canShowRecords ? records.total : 0,
            })}
          </span>
          <div>
            <Select
              value={String(pageSize)}
              onChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
              ariaLabel={t('usage_stats.page_size')}
              options={[10, 25, 50, 100].map((value) => ({
                value: String(value),
                label: t('usage_stats.per_page', { count: value }),
              }))}
              size="sm"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!query || recordsLoading || page <= 1}
              onClick={() => setPage((current) => current - 1)}
              aria-label={t('usage_stats.previous_page')}
            >
              <IconChevronLeft size={15} />
            </Button>
            <span>
              {page} / {Math.max(1, records.total_pages)}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={!query || recordsLoading || page >= records.total_pages}
              onClick={() => setPage((current) => current + 1)}
              aria-label={t('usage_stats.next_page')}
            >
              <IconChevronLeft size={15} style={{ transform: 'rotate(180deg)' }} />
            </Button>
          </div>
        </div>
      </article>
      <footer className={styles.pageFooter}>
        <span>{t('usage_stats.scope_note')}</span>
        {currentData && (
          <span>
            {t('usage_stats.last_updated')} {snapshotAt.toLocaleTimeString(i18n.language)}
          </span>
        )}
      </footer>
      <Modal
        open={managementOpen}
        onClose={() => setManagementOpen(false)}
        title={t('usage_stats.manage')}
        width={1100}
      >
        {managementOpen && <UsageManagement storage={data?.storage} onChange={refresh} />}
      </Modal>
      <UsageRecordModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
function MetricCard({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <article className={styles.metric}>
      <div className={`${styles.metricIcon} ${styles[tone]}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small title={detail}>{detail}</small>
      </div>
    </article>
  );
}

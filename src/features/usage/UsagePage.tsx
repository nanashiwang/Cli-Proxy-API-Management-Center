import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select } from '@/components/ui/Select';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { usageApi, type PricingOverrideInput } from '@/services/api/usage';
import { useNotificationStore } from '@/stores/useNotificationStore';
import type {
  ModelPricingStatus,
  ModelPricingSummary,
  UsageRequestDetail,
  UsageResponse,
} from '@/types/usage';
import {
  buildUsageTrendFromSnapshot,
  flattenUsageDetails,
  formatTokens,
  formatUSD,
  sortedDimensions,
} from './utils';
import type { UsageRange } from '@/types/usage';
import styles from './UsagePage.module.scss';

type PricingDraft = {
  model: string;
  provider: string;
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
};

const EMPTY_DRAFT: PricingDraft = {
  model: '',
  provider: '',
  input: '',
  output: '',
  cacheRead: '',
  cacheWrite: '',
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';

const fileSize = (value: number) => {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value || 0} B`;
};

const detailAccount = (detail: UsageRequestDetail) =>
  detail.auth_id ||
  detail.source ||
  (detail.auth_index ? `${detail.provider}:${detail.auth_index}` : detail.provider);

const hasUnreportedCodexCacheWrite = (detail: UsageRequestDetail) => {
  const model = (detail.alias || detail.billing?.pricing?.matched_model || '').toLowerCase();
  return (
    detail.billing?.reason === 'cache_write_tokens_unreported' ||
    (detail.provider.toLowerCase() === 'codex' &&
      detail.auth_type.toLowerCase() === 'oauth' &&
      model.startsWith('gpt-5.6') &&
      detail.tokens.input_tokens + detail.tokens.cache_read_tokens > 0 &&
      detail.tokens.cache_write_tokens === 0)
  );
};

export function UsagePage() {
  const { t } = useTranslation();
  const { showNotification, showConfirmation } = useNotificationStore();
  const [range, setRange] = useState<UsageRange>('7d');
  const [response, setResponse] = useState<UsageResponse | null>(null);
  const [pricingStatus, setPricingStatus] = useState<ModelPricingStatus | null>(null);
  const [pricingModels, setPricingModels] = useState<ModelPricingSummary[]>([]);
  const [pricingQuery, setPricingQuery] = useState('');
  const [pricingDraft, setPricingDraft] = useState<PricingDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    try {
      const [usage, status] = await Promise.all([
        usageApi.getUsage(undefined, undefined, range),
        usageApi.getPricingStatus().catch(() => null),
      ]);
      setResponse(usage);
      setPricingStatus(status);
    } catch (error) {
      showNotification(`${t('usage_stats.load_failed')}: ${errorMessage(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [range, showNotification, t]);

  const loadPricing = useCallback(async () => {
    setPricingLoading(true);
    try {
      const result = await usageApi.listPricing(pricingQuery, 100);
      setPricingModels(result.models ?? []);
    } catch (error) {
      showNotification(`${t('usage_stats.pricing_load_failed')}: ${errorMessage(error)}`, 'error');
    } finally {
      setPricingLoading(false);
    }
  }, [pricingQuery, showNotification, t]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPricing(), 250);
    return () => window.clearTimeout(timer);
  }, [loadPricing]);

  useHeaderRefresh(loadUsage);

  const usage = response?.usage;
  const storage = response?.storage;
  const details = useMemo(() => flattenUsageDetails(usage), [usage]);
  const recentDetails = details.slice(0, 30);
  const cacheWriteUnreported =
    Boolean(usage?.cache_write_unreported) || details.some(hasUnreportedCodexCacheWrite);
  const hasEstimatedCost =
    Boolean(usage?.estimated) ||
    cacheWriteUnreported ||
    details.some((detail) => detail.billing?.pricing?.estimated);
  const accounts = useMemo(() => sortedDimensions(usage?.accounts).slice(0, 12), [usage]);
  const models = useMemo(() => sortedDimensions(usage?.models).slice(0, 12), [usage]);
  const trend = useMemo(() => buildUsageTrendFromSnapshot(usage, range), [usage, range]);
  const maxTrendCost = Math.max(0, ...trend.map((point) => point.cost));
  const successRate = usage?.total_requests
    ? (usage.success_count / usage.total_requests) * 100
    : 0;

  const handleExport = async () => {
    try {
      const payload = await usageApi.exportUsage();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cpa-usage-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showNotification(t('usage_stats.export_success'), 'success');
    } catch (error) {
      showNotification(`${t('usage_stats.export_failed')}: ${errorMessage(error)}`, 'error');
    }
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      await usageApi.importUsage(payload);
      showNotification(t('usage_stats.import_success'), 'success');
      await loadUsage();
    } catch (error) {
      showNotification(`${t('usage_stats.import_failed')}: ${errorMessage(error)}`, 'error');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    showConfirmation({
      title: t('usage_stats.clear_title'),
      message: t('usage_stats.clear_confirm'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      variant: 'danger',
      onConfirm: async () => {
        await usageApi.clearUsage();
        showNotification(t('usage_stats.clear_success'), 'success');
        await loadUsage();
      },
    });
  };

  const handleRefreshPricing = async () => {
    setPricingLoading(true);
    try {
      const result = await usageApi.refreshPricing();
      setPricingStatus(result.status);
      await loadPricing();
      showNotification(t('usage_stats.pricing_refresh_success'), 'success');
    } catch (error) {
      showNotification(
        `${t('usage_stats.pricing_refresh_failed')}: ${errorMessage(error)}`,
        'error'
      );
    } finally {
      setPricingLoading(false);
    }
  };

  const editPricing = (model: ModelPricingSummary) => {
    setPricingDraft({
      model: model.model,
      provider: model.provider ?? '',
      input: String(model.input_usd_per_million_tokens),
      output: String(model.output_usd_per_million_tokens),
      cacheRead: String(model.cache_read_usd_per_million_tokens),
      cacheWrite: String(model.cache_write_usd_per_million_tokens),
    });
  };

  const handleSavePricing = async () => {
    if (!pricingDraft.model) return;
    const parseValue = (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
    };
    const payload: PricingOverrideInput = {
      provider: pricingDraft.provider.trim() || undefined,
      input: parseValue(pricingDraft.input),
      output: parseValue(pricingDraft.output),
      'cache-read': parseValue(pricingDraft.cacheRead),
      'cache-write': parseValue(pricingDraft.cacheWrite),
    };
    setSavingPricing(true);
    try {
      await usageApi.putCustomPricing(pricingDraft.model, payload);
      showNotification(t('usage_stats.pricing_save_success'), 'success');
      setPricingDraft(EMPTY_DRAFT);
      await Promise.all([loadPricing(), loadUsage()]);
    } catch (error) {
      showNotification(`${t('usage_stats.pricing_save_failed')}: ${errorMessage(error)}`, 'error');
    } finally {
      setSavingPricing(false);
    }
  };

  const handleDeletePricing = async (model: string) => {
    try {
      await usageApi.deleteCustomPricing(model);
      showNotification(t('usage_stats.pricing_delete_success'), 'success');
      await Promise.all([loadPricing(), loadUsage()]);
    } catch (error) {
      showNotification(
        `${t('usage_stats.pricing_delete_failed')}: ${errorMessage(error)}`,
        'error'
      );
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>{t('usage_stats.eyebrow')}</div>
          <h1>{t('usage_stats.title')}</h1>
          <p>{t('usage_stats.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <Select
            value={range}
            onChange={(value) => setRange(value as UsageRange)}
            ariaLabel={t('usage_stats.range_label')}
            options={[
              { value: '24h', label: t('usage_stats.range_24h') },
              { value: '7d', label: t('usage_stats.range_7d') },
              { value: '30d', label: t('usage_stats.range_30d') },
              { value: 'all', label: t('usage_stats.range_all') },
            ]}
          />
          <Button variant="secondary" onClick={() => void loadUsage()} loading={loading}>
            {t('common.refresh')}
          </Button>
        </div>
      </header>

      {storage?.last_error ? <div className={styles.errorBanner}>{storage.last_error}</div> : null}
      {response?.cache?.precomputed ? (
        <div className={styles.cacheMeta}>
          {t('usage_stats.precomputed_meta', { seconds: response.cache.age_seconds })}
        </div>
      ) : null}
      {cacheWriteUnreported ? (
        <div className={styles.warningBanner}>{t('usage_stats.cache_write_unreported')}</div>
      ) : null}

      <section className={styles.metrics} aria-busy={loading}>
        <MetricCard
          label={t('usage_stats.total_cost')}
          value={`${hasEstimatedCost ? '≈ ' : ''}${formatUSD(usage?.total_cost_usd ?? 0)}`}
          accent="cost"
        />
        <MetricCard
          label={t('usage_stats.total_requests')}
          value={(usage?.total_requests ?? 0).toLocaleString()}
        />
        <MetricCard
          label={t('usage_stats.total_tokens')}
          value={formatTokens(usage?.total_tokens ?? 0)}
        />
        <MetricCard
          label={t('usage_stats.success_rate')}
          value={`${successRate.toFixed(1)}%`}
          accent="success"
        />
        <MetricCard
          label={t('usage_stats.unpriced_requests')}
          value={(usage?.unpriced_requests ?? 0).toLocaleString()}
          accent={usage?.unpriced_requests ? 'warning' : undefined}
        />
      </section>

      {loading && !response ? (
        <div className={styles.loading}>
          <LoadingSpinner size={28} />
        </div>
      ) : (
        <>
          <section className={styles.gridTwo}>
            <article className={styles.panel}>
              <PanelHeader
                title={t('usage_stats.cost_trend')}
                meta={t('usage_stats.request_count', { count: usage?.total_requests ?? 0 })}
              />
              <div className={styles.trend}>
                {trend.map((point) => (
                  <div
                    className={styles.trendColumn}
                    key={point.key}
                    title={`${point.label}: ${formatUSD(point.cost)} / ${point.requests}`}
                  >
                    <div className={styles.trendValue}>
                      {point.cost > 0 ? formatUSD(point.cost) : ''}
                    </div>
                    <div className={styles.trendTrack}>
                      <div
                        className={styles.trendBar}
                        style={{
                          height: `${maxTrendCost ? Math.max(4, (point.cost / maxTrendCost) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span>{point.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <PanelHeader title={t('usage_stats.token_breakdown')} />
              <div className={styles.tokenGrid}>
                <TokenItem
                  label={t('usage_stats.input_tokens')}
                  value={usage?.tokens.input_tokens ?? 0}
                />
                <TokenItem
                  label={t('usage_stats.output_tokens')}
                  value={usage?.tokens.output_tokens ?? 0}
                />
                <TokenItem
                  label={t('usage_stats.cache_read_tokens')}
                  value={usage?.tokens.cache_read_tokens ?? 0}
                />
                <TokenItem
                  label={t('usage_stats.cache_write_tokens')}
                  value={usage?.tokens.cache_write_tokens ?? 0}
                />
                <TokenItem
                  label={t('usage_stats.reasoning_tokens')}
                  value={usage?.tokens.reasoning_tokens ?? 0}
                />
              </div>
              <div className={styles.storageMeta}>
                <span>
                  {storage?.enabled
                    ? t('usage_stats.storage_enabled')
                    : t('usage_stats.storage_disabled')}
                </span>
                <span>
                  {storage
                    ? `${storage.record_count.toLocaleString()} / ${storage.max_records.toLocaleString()}`
                    : '—'}
                </span>
                <span>
                  {storage
                    ? `${storage.retention_days}d · ${fileSize(storage.file_size_bytes)}`
                    : '—'}
                </span>
              </div>
            </article>
          </section>

          <section className={styles.gridTwo}>
            <RankingPanel title={t('usage_stats.accounts')} rows={accounts} />
            <RankingPanel title={t('usage_stats.models')} rows={models} />
          </section>

          <article className={styles.panel}>
            <PanelHeader
              title={t('usage_stats.recent_requests')}
              meta={t('usage_stats.latest_count', { count: recentDetails.length })}
            />
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>{t('usage_stats.time')}</th>
                    <th>{t('usage_stats.account')}</th>
                    <th>{t('usage_stats.model')}</th>
                    <th>{t('usage_stats.tokens')}</th>
                    <th>{t('usage_stats.cost')}</th>
                    <th>{t('usage_stats.latency')}</th>
                    <th>{t('usage_stats.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDetails.length ? (
                    recentDetails.map((detail, index) => (
                      <tr key={detail.request_id || `${detail.timestamp}-${index}`}>
                        <td>{new Date(detail.timestamp).toLocaleString()}</td>
                        <td title={detail.source}>{detailAccount(detail)}</td>
                        <td>
                          <strong>
                            {detail.alias || detail.billing?.pricing?.matched_model || 'unknown'}
                          </strong>
                          <small>
                            {detail.provider} · {detail.service_tier}
                          </small>
                        </td>
                        <td>{formatTokens(detail.tokens.total_tokens)}</td>
                        <td>
                          {detail.billing?.priced ? (
                            `${
                              detail.billing.pricing?.estimated ||
                              hasUnreportedCodexCacheWrite(detail)
                                ? '≈ '
                                : ''
                            }${formatUSD(detail.cost_usd ?? detail.billing.total_usd)}`
                          ) : (
                            <span className={styles.muted}>{detail.billing?.reason || '—'}</span>
                          )}
                        </td>
                        <td>{detail.latency_ms.toLocaleString()} ms</td>
                        <td>
                          <span className={detail.failed ? styles.failed : styles.success}>
                            {detail.status_code}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className={styles.empty}>
                        {t('usage_stats.no_data')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className={styles.panel}>
            <PanelHeader
              title={t('usage_stats.pricing_title')}
              meta={
                pricingStatus
                  ? `${pricingStatus.model_count.toLocaleString()} · ${pricingStatus.active_source}`
                  : undefined
              }
            />
            <div className={styles.pricingToolbar}>
              <input
                value={pricingQuery}
                onChange={(event) => setPricingQuery(event.target.value)}
                placeholder={t('usage_stats.pricing_search')}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleRefreshPricing()}
                loading={pricingLoading}
              >
                {t('usage_stats.pricing_refresh')}
              </Button>
            </div>
            {pricingStatus?.last_error ? (
              <div className={styles.errorBanner}>{pricingStatus.last_error}</div>
            ) : null}
            <div className={`${styles.tableWrap} ${styles.pricingTableWrap}`}>
              <table>
                <thead>
                  <tr>
                    <th>{t('usage_stats.model')}</th>
                    <th>{t('usage_stats.provider')}</th>
                    <th>{t('usage_stats.input_price')}</th>
                    <th>{t('usage_stats.output_price')}</th>
                    <th>{t('usage_stats.cache_read_price')}</th>
                    <th>{t('usage_stats.cache_write_price')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pricingModels.map((model) => (
                    <tr key={model.model}>
                      <td>
                        <strong>{model.model}</strong>
                        {model.custom_override ? (
                          <small>{t('usage_stats.custom_override')}</small>
                        ) : null}
                      </td>
                      <td>{model.provider || '—'}</td>
                      <td>{formatUSD(model.input_usd_per_million_tokens)}</td>
                      <td>{formatUSD(model.output_usd_per_million_tokens)}</td>
                      <td>{formatUSD(model.cache_read_usd_per_million_tokens)}</td>
                      <td>{formatUSD(model.cache_write_usd_per_million_tokens)}</td>
                      <td className={styles.rowActions}>
                        <button onClick={() => editPricing(model)}>{t('common.edit')}</button>
                        {model.custom_override ? (
                          <button onClick={() => void handleDeletePricing(model.model)}>
                            {t('common.delete')}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          {pricingDraft.model ? (
            <article className={styles.panel}>
              <PanelHeader title={t('usage_stats.pricing_edit', { model: pricingDraft.model })} />
              <div className={styles.priceForm}>
                {(['provider', 'input', 'output', 'cacheRead', 'cacheWrite'] as const).map(
                  (field) => (
                    <label key={field}>
                      <span>{t(`usage_stats.field_${field}`)}</span>
                      <input
                        value={pricingDraft[field]}
                        onChange={(event) =>
                          setPricingDraft((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )
                )}
              </div>
              <div className={styles.formActions}>
                <Button variant="ghost" onClick={() => setPricingDraft(EMPTY_DRAFT)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={() => void handleSavePricing()} loading={savingPricing}>
                  {t('common.save')}
                </Button>
              </div>
            </article>
          ) : null}

          <article className={`${styles.panel} ${styles.storagePanel}`}>
            <div>
              <h2>{t('usage_stats.storage_title')}</h2>
              <p>{storage?.storage_path || t('usage_stats.storage_path_default')}</p>
            </div>
            <div className={styles.headerActions}>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => void handleImport(event.target.files?.[0])}
              />
              <Button variant="secondary" size="sm" onClick={() => importInputRef.current?.click()}>
                {t('usage_stats.import')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void handleExport()}>
                {t('usage_stats.export')}
              </Button>
              <Button variant="danger" size="sm" onClick={handleClear}>
                {t('usage_stats.clear')}
              </Button>
            </div>
          </article>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'cost' | 'success' | 'warning';
}) {
  return (
    <article className={`${styles.metric} ${accent ? styles[accent] : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className={styles.panelHeader}>
      <h2>{title}</h2>
      {meta ? <span>{meta}</span> : null}
    </div>
  );
}

function TokenItem({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.tokenItem}>
      <span>{label}</span>
      <strong>{formatTokens(value)}</strong>
    </div>
  );
}

function RankingPanel({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof sortedDimensions>;
}) {
  return (
    <article className={styles.panel}>
      <PanelHeader title={title} />
      <div className={styles.ranking}>
        {rows.length ? (
          rows.map(([name, value], index) => (
            <div className={styles.rankRow} key={name}>
              <span className={styles.rankIndex}>{index + 1}</span>
              <div>
                <strong title={name}>{name}</strong>
                <small>
                  {value.total_requests.toLocaleString()} req · {formatTokens(value.total_tokens)}{' '}
                  tok
                </small>
              </div>
              <b>{formatUSD(value.total_cost_usd)}</b>
            </div>
          ))
        ) : (
          <div className={styles.empty}>—</div>
        )}
      </div>
    </article>
  );
}

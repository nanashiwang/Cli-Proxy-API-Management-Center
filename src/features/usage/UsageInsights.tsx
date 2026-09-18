import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UsageDashboard, UsageDimension } from '@/types/usage';
import { UsageChart } from './UsageChart';
import { formatDuration, formatRate } from './analytics';
import { formatTokens, formatUSD } from './utils';
import styles from './UsagePage.module.scss';

export function Segments<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className={styles.segments} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong style={tone ? { color: tone } : undefined}>{value}</strong>
    </div>
  );
}

export function UsageInsights({
  data,
  onDimension,
}: {
  data: UsageDashboard;
  onDimension: (key: 'model' | 'provider' | 'account', value: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [dimension, setDimension] = useState<'models' | 'providers' | 'accounts'>('models');
  const [performanceView, setPerformanceView] = useState<'latency' | 'ttft'>('latency');
  const [costView, setCostView] = useState<'cost' | 'tokens' | 'cache'>('cost');
  const labels = data.trend.map((point) =>
    new Intl.DateTimeFormat(
      i18n.language,
      data.granularity === 'hour'
        ? { month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }
        : { month: '2-digit', day: '2-digit' }
    ).format(new Date(point.timestamp))
  );
  const perf = data.performance;
  const rows = [...data.dimensions[dimension]]
    .sort((a, b) => b.total_requests - a.total_requests)
    .slice(0, 7);
  const numeric = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 0 });
  const costSeries =
    costView === 'cost'
      ? [
          {
            label: t('usage_stats.total_cost'),
            color: 'var(--usage-green)',
            values: data.trend.map((p) => p.known_cost_usd),
          },
        ]
      : costView === 'tokens'
        ? [
            {
              label: t('usage_stats.input_tokens'),
              color: 'var(--usage-blue)',
              values: data.trend.map((p) => p.tokens.input_tokens),
            },
            {
              label: t('usage_stats.output_tokens'),
              color: 'var(--usage-green)',
              values: data.trend.map((p) => p.tokens.output_tokens),
            },
            {
              label: t('usage_stats.cache_read_tokens'),
              color: 'var(--usage-orange)',
              values: data.trend.map((p) => p.tokens.cache_read_tokens),
            },
          ]
        : [
            {
              label: t('usage_stats.cache_read_tokens'),
              color: 'var(--usage-orange)',
              values: data.trend.map((p) => p.tokens.cache_read_tokens),
            },
            {
              label: t('usage_stats.cache_write_tokens'),
              color: 'var(--usage-blue)',
              values: data.trend.map((p) => p.tokens.cache_write_tokens),
            },
          ];
  return (
    <section className={styles.insightsGrid} aria-label={t('usage_stats.observability')}>
      <article className={styles.insightPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{t('usage_stats.health_title')}</h2>
            <p>{t('usage_stats.health_description')}</p>
          </div>
          <span className={styles.panelTag}>
            {t(`usage_stats.granularity_${data.granularity}`)}
          </span>
        </div>
        <div className={styles.miniMetrics}>
          <MiniMetric
            label={t('usage_stats.success_rate')}
            value={data.summary.total_requests ? formatRate(data.health.success_rate) : '—'}
            tone="var(--usage-green)"
          />
          <MiniMetric
            label={t('usage_stats.failed_requests')}
            value={numeric(data.summary.failure_count)}
          />
          <MiniMetric
            label={t('usage_stats.rate_limited')}
            value={numeric(data.health.rate_limited_count)}
            tone="var(--usage-orange)"
          />
        </div>
        <UsageChart
          hasActivity={data.summary.total_requests > 0}
          labels={labels}
          stacked
          format={numeric}
          series={[
            {
              label: t('usage_stats.succeeded'),
              color: 'var(--usage-green)',
              values: data.trend.map((p) => p.success_count),
            },
            {
              label: t('usage_stats.failed'),
              color: 'var(--usage-red)',
              values: data.trend.map((p) => p.failure_count),
            },
          ]}
        />
        <div className={styles.panelFootnote}>
          {t('usage_stats.http_errors', {
            client: data.health.client_error_count,
            server: data.health.server_error_count,
          })}
        </div>
      </article>
      <article className={styles.insightPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{t('usage_stats.diagnostics_title')}</h2>
            <p>{t('usage_stats.diagnostics_description')}</p>
          </div>
          <Segments
            label={t('usage_stats.diagnostic_dimension')}
            value={dimension}
            onChange={setDimension}
            options={[
              { value: 'models', label: t('usage_stats.model') },
              { value: 'accounts', label: t('usage_stats.account') },
              { value: 'providers', label: t('usage_stats.provider') },
            ]}
          />
        </div>
        <div className={styles.dimensionTable}>
          <div className={styles.dimensionHead}>
            <span>{t(`usage_stats.dimension_${dimension}`)}</span>
            <span>{t('usage_stats.total_requests')}</span>
            <span>{t('usage_stats.error_rate')}</span>
            <span>{t('usage_stats.cost')}</span>
          </div>
          {rows.length ? (
            rows.map((row) => (
              <DimensionRow
                key={row.key}
                row={row}
                total={data.summary.total_requests}
                onClick={() =>
                  onDimension(
                    dimension === 'models'
                      ? 'model'
                      : dimension === 'providers'
                        ? 'provider'
                        : 'account',
                    row.key
                  )
                }
              />
            ))
          ) : (
            <div className={styles.chartEmpty}>{t('usage_stats.no_data')}</div>
          )}
        </div>
        <div className={styles.panelFootnote}>{t('usage_stats.dimension_hint')}</div>
      </article>
      <article className={styles.insightPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{t('usage_stats.performance_title')}</h2>
            <p>{t('usage_stats.performance_description')}</p>
          </div>
          <Segments
            label={t('usage_stats.performance_metric')}
            value={performanceView}
            onChange={setPerformanceView}
            options={[
              { value: 'latency', label: t('usage_stats.latency') },
              { value: 'ttft', label: t('usage_stats.ttft') },
            ]}
          />
        </div>
        <div className={styles.miniMetrics}>
          {(['p50', 'p95', 'p99'] as const).map((percentile) => (
            <MiniMetric
              key={percentile}
              label={percentile.toUpperCase()}
              value={formatDuration(perf[`${performanceView}_${percentile}_ms`])}
            />
          ))}
        </div>
        <UsageChart
          hasActivity={data.summary.total_requests > 0}
          labels={labels}
          format={formatDuration}
          series={(['p50', 'p95', 'p99'] as const).map((percentile, index) => ({
            label: percentile.toUpperCase(),
            color: ['var(--usage-blue)', 'var(--usage-orange)', 'var(--usage-red)'][index],
            values: data.trend.map((p) => p[`${performanceView}_${percentile}_ms`] ?? null),
          }))}
        />
        <div className={styles.panelFootnote}>
          <span>
            {t('usage_stats.sample_coverage', {
              count: performanceView === 'latency' ? perf.latency_samples : perf.ttft_samples,
              rate: formatRate(
                performanceView === 'latency' ? perf.latency_coverage : perf.ttft_coverage
              ),
            })}
          </span>
          <span>
            {t('usage_stats.throughput')}:{' '}
            {perf.output_tokens_per_second == null
              ? '—'
              : `${perf.output_tokens_per_second.toFixed(1)} tok/s`}
          </span>
        </div>
      </article>
      <article className={styles.insightPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{t('usage_stats.cost_title')}</h2>
            <p>{t('usage_stats.cost_description')}</p>
          </div>
          <Segments
            label={t('usage_stats.cost_metric')}
            value={costView}
            onChange={setCostView}
            options={[
              { value: 'cost', label: t('usage_stats.cost') },
              { value: 'tokens', label: t('usage_stats.tokens') },
              { value: 'cache', label: t('usage_stats.cache') },
            ]}
          />
        </div>
        <div className={styles.miniMetrics}>
          <MiniMetric
            label={t('usage_stats.total_cost')}
            value={
              data.cost.total_cost_usd == null
                ? '—'
                : `${data.summary.estimated ? '≈ ' : ''}${formatUSD(data.cost.total_cost_usd)}`
            }
            tone="var(--usage-green)"
          />
          <MiniMetric
            label={t('usage_stats.average_cost')}
            value={data.cost.avg_cost_usd == null ? '—' : formatUSD(data.cost.avg_cost_usd)}
          />
          <MiniMetric
            label={t('usage_stats.pricing_coverage')}
            value={data.summary.total_requests ? formatRate(data.cost.pricing_coverage) : '—'}
          />
        </div>
        <UsageChart
          hasActivity={data.summary.total_requests > 0}
          labels={labels}
          format={costView === 'cost' ? formatUSD : formatTokens}
          series={costSeries}
        />
        <div className={styles.panelFootnote}>
          <span>
            {t('usage_stats.cache_read_ratio')}: {formatRate(data.cost.cache_read_ratio)}
          </span>
          <span>
            {t('usage_stats.unpriced_requests')}: {numeric(data.cost.unpriced_requests)}
          </span>
        </div>
      </article>
    </section>
  );
}

function DimensionRow({
  row,
  total,
  onClick,
}: {
  row: UsageDimension;
  total: number;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.dimensionRow}
      onClick={onClick}
      title={t('usage_stats.filter_dimension', { name: row.label })}
    >
      <div>
        <strong>{row.label || '—'}</strong>
        <small>
          {t('usage_stats.avg_latency')}: {formatDuration(row.avg_latency_ms)}
        </small>
      </div>
      <div>
        <b>{row.total_requests.toLocaleString()}</b>
        <small>{formatRate(total ? row.total_requests / total : 0)}</small>
      </div>
      <div style={row.failure_count ? { color: 'var(--usage-red)' } : undefined}>
        <b>{formatRate(row.error_rate)}</b>
        <small>{t('usage_stats.failures_count', { count: row.failure_count })}</small>
      </div>
      <div>
        <b>{row.priced_requests ? formatUSD(row.total_cost_usd) : '—'}</b>
        <small>{formatTokens(row.total_tokens)} tok</small>
      </div>
    </button>
  );
}

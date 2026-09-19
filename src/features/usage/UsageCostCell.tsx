import { useTranslation } from 'react-i18next';
import type { UsageRecord } from '@/types/usage';
import { usageCostRows, usageRecordedCost } from './costPresentation';
import { formatUSD } from './utils';
import { UsageInfoPopover } from './UsageInfoPopover';
import styles from './UsageCostCell.module.scss';

export function UsageCostCell({ record }: { record: UsageRecord }) {
  const { t, i18n } = useTranslation();
  const pricing = record.billing?.pricing;
  const cost = usageRecordedCost(record);
  const format = (value: number | null) => (value === null ? '—' : formatUSD(value));
  const total = `${cost !== null && pricing?.estimated ? '≈ ' : ''}${format(cost)}`;
  const reasonKey = `usage_stats.billing_reason_${record.billing?.reason || 'unknown'}`;
  return (
    <div className={styles.cell}>
      <div className={styles.amount}>
        <span>{total}</span>
        {!record.billing?.priced && <small>{t('usage_stats.unpriced')}</small>}
      </div>
      <UsageInfoPopover label={t('usage_stats.price_details')} width={386}>
        {record.billing?.priced ? (
          <>
            <div
              className={styles.priceTable}
              role="table"
              aria-label={t('usage_stats.billing_breakdown')}
            >
              <div role="row" className={styles.priceHeader}>
                <span role="columnheader">{t('usage_stats.price_item')}</span>
                <span role="columnheader">{t('usage_stats.price_per_million')}</span>
                <span role="columnheader">{t('usage_stats.cost')}</span>
              </div>
              {usageCostRows(record).map((row) => (
                <div role="row" key={row.key}>
                  <span role="cell">
                    {t(
                      row.key === 'output'
                        ? 'usage_stats.token_output_total'
                        : `usage_stats.${row.key}_tokens`
                    )}
                  </span>
                  <span role="cell">{format(row.unitPrice)}</span>
                  <span role="cell">{format(row.cost)}</span>
                </div>
              ))}
            </div>
            <dl>
              <div data-total>
                <dt>{t('usage_stats.total_cost')}</dt>
                <dd>{total}</dd>
              </div>
            </dl>
            <p>{t('usage_stats.price_snapshot_note')}</p>
            {pricing?.estimated && <p>{t('usage_stats.price_estimated_note')}</p>}
          </>
        ) : (
          <p>{t(i18n.exists(reasonKey) ? reasonKey : 'usage_stats.billing_reason_unknown')}</p>
        )}
        <dl className={styles.snapshot}>
          <div>
            <dt>{t('usage_stats.priced_model')}</dt>
            <dd>{pricing?.matched_model || '—'}</dd>
          </div>
          <div>
            <dt>{t('usage_stats.pricing_source')}</dt>
            <dd>{pricing?.source || '—'}</dd>
          </div>
          <div>
            <dt>{t('usage_stats.service_tier')}</dt>
            <dd>{pricing?.service_tier || '—'}</dd>
          </div>
          {Boolean(pricing?.context_threshold_tokens) && (
            <div>
              <dt>{t('usage_stats.price_context_threshold')}</dt>
              <dd>{pricing?.context_threshold_tokens?.toLocaleString(i18n.language)}</dd>
            </div>
          )}
          <div>
            <dt>{t('usage_stats.pricing_version')}</dt>
            <dd>{pricing?.version || '—'}</dd>
          </div>
        </dl>
      </UsageInfoPopover>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { IconInbox } from '@/components/ui/icons';
import type { UsageRecord } from '@/types/usage';
import { usageTokenMetrics } from './tokenPresentation';
import { formatTokens } from './utils';
import { UsageInfoPopover } from './UsageInfoPopover';
import styles from './UsageTokenCell.module.scss';

export function UsageTokenCell({ record }: { record: UsageRecord }) {
  const { t, i18n } = useTranslation();
  const metrics = usageTokenMetrics(record);
  const exact = (value: number | null) =>
    value === null ? '—' : value.toLocaleString(i18n.language);
  const cacheUnreported =
    metrics.cacheWrite === 0 && record.billing?.reason === 'cache_write_tokens_unreported';

  return (
    <div className={styles.summary}>
      <div className={styles.values}>
        <div className={styles.flow}>
          <span
            className={styles.input}
            title={`${t('usage_stats.token_input_total')}: ${exact(metrics.input)}`}
          >
            <span aria-hidden="true">↓</span>
            <span>{exact(metrics.input)}</span>
          </span>
          <span
            className={styles.output}
            title={`${t('usage_stats.token_output_total')}: ${exact(metrics.output)}`}
          >
            <span aria-hidden="true">↑</span>
            <span>{exact(metrics.output)}</span>
          </span>
        </div>
        <span
          className={styles.cache}
          title={`${t('usage_stats.cache_read_tokens')}: ${exact(metrics.cacheRead)}`}
        >
          <IconInbox size={15} />
          <span>{metrics.cacheRead === null ? '—' : formatTokens(metrics.cacheRead)}</span>
          {metrics.unclassified !== null && metrics.unclassified > 0 && (
            <span className={styles.unclassified} title={t('usage_stats.unclassified_tokens')}>
              {t('usage_stats.unclassified_tokens')} {formatTokens(metrics.unclassified)}
            </span>
          )}
        </span>
      </div>
      <UsageInfoPopover label={t('usage_stats.token_details')}>
        <dl>
          <div>
            <dt>{t('usage_stats.token_input_total')}</dt>
            <dd>{exact(metrics.input)}</dd>
          </div>
          <div>
            <dt>{t('usage_stats.token_output_total')}</dt>
            <dd>{exact(metrics.output)}</dd>
          </div>
          <div>
            <dt>{t('usage_stats.cache_read_tokens')}</dt>
            <dd>{exact(metrics.cacheRead)}</dd>
          </div>
          <div>
            <dt>{t('usage_stats.cache_write_tokens')}</dt>
            <dd>
              {cacheUnreported ? t('usage_stats.token_unreported') : exact(metrics.cacheWrite)}
            </dd>
          </div>
          <div>
            <dt>{t('usage_stats.reasoning_tokens')}</dt>
            <dd>{exact(metrics.reasoning)}</dd>
          </div>
          {metrics.unclassified !== null && metrics.unclassified > 0 && (
            <div>
              <dt>{t('usage_stats.unclassified_tokens')}</dt>
              <dd>{exact(metrics.unclassified)}</dd>
            </div>
          )}
          <div data-total>
            <dt>{t('usage_stats.total_tokens')}</dt>
            <dd>{exact(metrics.total)}</dd>
          </div>
        </dl>
        <p>
          {t(
            metrics.quality === 'unavailable'
              ? 'usage_stats.token_legacy_note'
              : 'usage_stats.token_inclusive_note'
          )}
        </p>
        {metrics.quality !== 'complete' && metrics.quality !== 'unavailable' && (
          <p>{t(`usage_stats.quality_${metrics.quality}`)}</p>
        )}
      </UsageInfoPopover>
    </div>
  );
}

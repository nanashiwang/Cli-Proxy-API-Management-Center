/**
 * 额度卡片：头部（提供商图标 + mono 文件名）+ 四态 body + 统计/动作 footer。
 *
 * - idle：整个 body 是一个点击加载按钮（上游直连有速率考虑，不自动拉取）；
 * - loading：双幽灵行骨架（aria-busy，文字等价视觉隐藏）；
 * - error：失败色条 + footer 刷新即重试；
 * - success：provider Body（穿 QuotaBody.module.scss 全页外衣）。
 */

import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { IconDollarSign, IconInfo, IconRefreshCw, IconSidebarUsage } from '@/components/ui/icons';
import type { ResolvedTheme } from '@/types';
import { formatUSD } from '@/features/usage/utils';
import { resolveQuotaErrorMessage } from '@/utils/quota';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isThemeSurfaceIconProvider,
} from '@/features/authFiles/constants';
import { bindQuotaClasses } from '../types';
import { QUOTA_ADAPTERS, type QuotaCardState } from '../providers';
import { isQuotaRefreshDisabled, type QuotaFileEntry } from '../logic';
import type { QuotaUsageCost } from '../usageCost';
import bodyStyles from './QuotaBody.module.scss';
import styles from './QuotaCard.module.scss';

/** 额度页全页外衣：QuotaBody 模块绑定成类型化契约（缺键在模块初始化即抛）。 */
const quotaClasses = bindQuotaClasses(bodyStyles, 'QuotaBody.module.scss');

const progressStyle = (percent: number | undefined): CSSProperties =>
  ({
    '--quota-stat-progress': `${Math.max(0, Math.min(100, percent ?? 0))}%`,
  }) as CSSProperties;

const displayPercent = (percent: number): number => Math.round(percent * 10) / 10;

export type QuotaCardProps = {
  entry: QuotaFileEntry;
  quota?: QuotaCardState;
  resolvedTheme: ResolvedTheme;
  canRefresh: boolean;
  resetting: boolean;
  usageCost?: QuotaUsageCost;
  /** 首屏级联入场延迟；null = 不入场（切 tab / 翻页 / 刷新新挂载的卡片）。 */
  entranceDelayMs?: number | null;
  onRefresh: () => void;
  onReset: () => void;
};

export function QuotaCard(props: QuotaCardProps) {
  const {
    entry,
    quota,
    resolvedTheme,
    canRefresh,
    resetting,
    usageCost,
    entranceDelayMs,
    onRefresh,
    onReset,
  } = props;
  const { t } = useTranslation();
  const adapter = QUOTA_ADAPTERS[entry.type];
  const file = entry.file;

  // 挂载时捕获一次延迟：后续 props 变 null 不影响本卡（React 19 禁渲染期读 ref）
  const [mountEntranceDelayMs] = useState<number | null>(entranceDelayMs ?? null);
  const entranceStyle =
    mountEntranceDelayMs === null
      ? undefined
      : ({ '--card-delay': `${mountEntranceDelayMs}ms` } as CSSProperties);

  const status = quota?.status ?? 'idle';
  const loading = status === 'loading';
  const iconSrc = getAuthFileIcon(entry.type, resolvedTheme);
  const typeLabel = getTypeLabel(t, entry.type);
  const errorMessage = resolveQuotaErrorMessage(
    t,
    quota?.errorStatus,
    quota?.error || t('common.unknown_error')
  );
  const showReset =
    status === 'success' &&
    Boolean(adapter.resetQuota) &&
    quota !== undefined &&
    Boolean(adapter.canResetQuota?.(quota));
  const usageCostHint = usageCost
    ? [
        t('quota_management.cost_requests', { count: usageCost.totalRequests }),
        usageCost.estimated ? t('quota_management.estimated_cost_hint') : '',
        usageCost.cacheWriteUnreported ? t('quota_management.cache_write_unreported_hint') : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const weekly = usageCost?.weekly;
  const weeklyValue = weekly
    ? weekly.status === 'ready' && weekly.totalUsd !== undefined
      ? `≈ ${formatUSD(weekly.totalUsd)}`
      : t(`quota_management.weekly_estimate_${weekly.status}`)
    : '';
  const weeklyConfidence = weekly?.confidence
    ? t(`quota_management.confidence_${weekly.confidence}`)
    : '';
  const weeklyMeta =
    weekly && weekly.status === 'ready' && weeklyConfidence
      ? t('quota_management.weekly_usage_confidence', {
          percent: Math.round(weekly.usedPercent),
          confidence: weeklyConfidence,
        })
      : '';
  const weeklyHint =
    weekly &&
    weekly.status === 'ready' &&
    weekly.sampledCostUsd !== undefined &&
    weekly.sampledPercent !== undefined
      ? [
          t('quota_management.weekly_estimate_hint', {
            costDelta: formatUSD(weekly.sampledCostUsd),
            percentDelta: displayPercent(weekly.sampledPercent),
          }),
          weeklyMeta,
          weekly.coverageComplete === false
            ? t('quota_management.weekly_partial_coverage_hint')
            : '',
          weekly.estimated ? t('quota_management.estimated_cost_hint') : '',
          weekly.cacheWriteUnreported ? t('quota_management.cache_write_unreported_hint') : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : '';
  const weeklyDisplayHint =
    weekly?.status === 'sampling' ? t('quota_management.weekly_sampling_hint') : weeklyHint;
  const weeklyUsedLabel = weekly
    ? t('quota_management.weekly_current_usage', {
        percent: Math.round(weekly.usedPercent),
      })
    : '';
  const weeklySampleLabel =
    weekly?.status === 'ready' && weekly.sampledPercent !== undefined
      ? t('quota_management.weekly_sample_delta', {
          percent: displayPercent(weekly.sampledPercent),
        })
      : '';
  // 10 个百分点对应“高”置信度；进度条表示样本跨度，而不是再次冒充官方额度。
  const weeklySampleProgress =
    weekly?.status === 'ready' && weekly.sampledPercent !== undefined
      ? Math.min(100, weekly.sampledPercent * 10)
      : 0;
  const footerClassName = [
    styles.statsFooter,
    usageCost ? '' : styles.statsFooterActionsOnly,
    usageCost && !weekly ? styles.statsFooterNoWeekly : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={`${styles.card} ${mountEntranceDelayMs === null ? '' : styles.cardEnter}`}
      style={entranceStyle}
    >
      <header className={styles.head}>
        <span
          className={styles.iconWrap}
          title={typeLabel}
          style={
            isThemeSurfaceIconProvider(entry.type)
              ? { background: getThemeSurfaceIconBackground(resolvedTheme) }
              : undefined
          }
        >
          {iconSrc ? (
            <img src={iconSrc} alt="" className={styles.icon} />
          ) : (
            <span className={styles.iconFallback}>{typeLabel.slice(0, 1).toUpperCase()}</span>
          )}
        </span>
        <span className={styles.fileName} title={file.name}>
          {file.name}
        </span>
      </header>

      <div className={styles.body}>
        {status === 'idle' ? (
          <button
            type="button"
            className={styles.idleBody}
            onClick={onRefresh}
            disabled={!canRefresh}
          >
            <IconRefreshCw size={15} aria-hidden="true" className={styles.idleGlyph} />
            <span className={styles.idleHint}>{t(`${adapter.i18nPrefix}.idle`)}</span>
          </button>
        ) : loading ? (
          <div className={styles.skeleton} aria-busy="true">
            <span className={styles.srOnly}>{t(`${adapter.i18nPrefix}.loading`)}</span>
            {[0, 1].map((row) => (
              <div key={row} className={styles.skeletonRow} aria-hidden="true">
                <span className={styles.skeletonLabel} />
                <span className={styles.skeletonTrack} />
              </div>
            ))}
          </div>
        ) : status === 'error' ? (
          <div className={styles.errorStrip} role="alert">
            {t(`${adapter.i18nPrefix}.load_failed`, { message: errorMessage })}
          </div>
        ) : quota ? (
          <adapter.Body quota={quota} classes={quotaClasses} />
        ) : (
          <div className={styles.idleHint}>{t(`${adapter.i18nPrefix}.idle`)}</div>
        )}
      </div>

      {(usageCost || status !== 'idle') && (
        <footer className={footerClassName}>
          {usageCost && (
            <div className={styles.statBlock} title={usageCostHint || undefined}>
              <div className={styles.statHeading}>
                <IconDollarSign size={14} aria-hidden="true" />
                <span>{t('quota_management.seven_day_cost')}</span>
                {usageCostHint && <IconInfo size={12} className={styles.statInfo} />}
              </div>
              <div className={styles.statValueRow}>
                <strong className={styles.statValue}>
                  {usageCost.estimated ? '≈ ' : ''}
                  {formatUSD(usageCost.totalUsd)}
                </strong>
                {weeklyUsedLabel && <span className={styles.statBadge}>{weeklyUsedLabel}</span>}
              </div>
              {weekly && (
                <div
                  className={styles.statProgress}
                  style={progressStyle(weekly.usedPercent)}
                  aria-hidden="true"
                >
                  <span />
                </div>
              )}
            </div>
          )}

          {usageCost && weekly && <span className={styles.statDivider} aria-hidden="true" />}

          {weekly && (
            <div className={styles.statBlock} title={weeklyDisplayHint || undefined}>
              <div className={styles.statHeading}>
                <IconSidebarUsage size={14} aria-hidden="true" />
                <span>{t('quota_management.weekly_cost_estimate')}</span>
                {weeklyDisplayHint && <IconInfo size={12} className={styles.statInfo} />}
              </div>
              <div className={styles.statValueRow}>
                <strong className={styles.statValue}>{weeklyValue}</strong>
                {weekly.status === 'ready' && (
                  <span className={styles.statBadge}>
                    {t('quota_management.weekly_estimated_badge')}
                  </span>
                )}
              </div>
              <div className={styles.statProgressRow}>
                <div
                  className={styles.statProgress}
                  style={progressStyle(weeklySampleProgress)}
                  aria-hidden="true"
                >
                  <span />
                </div>
                {weeklySampleLabel && (
                  <span className={styles.statProgressLabel}>{weeklySampleLabel}</span>
                )}
              </div>
            </div>
          )}

          {usageCost && <span className={styles.statDivider} aria-hidden="true" />}

          <div className={styles.actionBlock}>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={onRefresh}
              disabled={isQuotaRefreshDisabled(canRefresh, loading, resetting)}
              title={t('auth_files.quota_refresh_hint')}
            >
              <IconRefreshCw size={15} className={loading ? styles.spinning : undefined} />
              {t('auth_files.quota_refresh_single')}
            </button>
            {showReset && (
              <button
                type="button"
                className={styles.resetButton}
                onClick={onReset}
                disabled={!canRefresh || loading || resetting}
                title={t('codex_quota.reset_button')}
              >
                <IconRefreshCw size={12} className={resetting ? styles.spinning : undefined} />
                {t('codex_quota.reset_button')}
              </button>
            )}
          </div>
        </footer>
      )}
    </article>
  );
}

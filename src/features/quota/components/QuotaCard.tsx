/**
 * Provider quota card: identity, loading/error state, quota body, and actions.
 * Claude observations remain visible while refreshing or after a failed read.
 */

import { useState, type CSSProperties } from 'react';
import { BackendQuotaBody } from './BackendQuotaBody';
import { useInterval } from '@/hooks/useInterval';
import { quotaWaitUntil } from '../cooldown';
import { useTranslation } from 'react-i18next';
import { IconDollarSign, IconInfo, IconRefreshCw, IconSidebarUsage, IconChevronDown } from '@/components/ui/icons';
import type { ClaudeQuotaState, CodexQuotaState, ResolvedTheme } from '@/types';
import { formatUSD } from '@/features/usage/utils';
import { resolveQuotaErrorMessage } from '@/utils/quota';
import { getQuotaDisplayName } from '@/utils/quota/identity';
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
import { useClaudeResetGrants } from '../providers/claude/ClaudeResetGrants';
import { ClaudeResetGrantDialog } from '../providers/claude/ClaudeResetGrantDialog';
import { ClaudeResetGrantDetails } from '../providers/claude/ClaudeResetGrantDetails';
import { hasClaudeUsageData } from '../providers/claude/data';
import { CodexCreditOverageDialog } from '../providers/codex/CodexCreditOverageDialog';
import { CodexCreditOverageRow } from '../providers/codex/CodexCreditOverageRow';
import { useCodexCreditOverage } from '../providers/codex/useCodexCreditOverage';
import bodyStyles from './QuotaBody.module.scss';
import styles from './QuotaCard.module.scss';

/** Bind the quota-page styles to the shared rendering contract. */
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
  /** Initial cascade delay; null disables entrance motion for later mounts. */
  entranceDelayMs?: number | null;
  /**
   * Compact layout only: true shows the glance card (name, plan, one line per limit),
   * false the full card. Undefined (other layouts) shows the full card with no toggle.
   */
  glance?: boolean;
  onToggleGlance?: () => void;
  /** Codex only: credentials in the panel sharing this account user's credit setting. */
  creditOverageSharedCount?: number;
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
    glance,
    onToggleGlance,
    creditOverageSharedCount = 1,
    onRefresh,
    onReset,
  } = props;
  const { t } = useTranslation();
  const adapter = QUOTA_ADAPTERS[entry.type];
  const file = entry.file;
  const retainedClaudeUsage =
    entry.type === 'claude' && hasClaudeUsageData(quota as ClaudeQuotaState | undefined);
  const displayName = getQuotaDisplayName(file);

  // Capture the entrance delay only at mount, without a render-time ref read.
  const [mountEntranceDelayMs] = useState<number | null>(entranceDelayMs ?? null);
  const entranceStyle =
    mountEntranceDelayMs === null
      ? undefined
      : ({ '--card-delay': `${mountEntranceDelayMs}ms` } as CSSProperties);

  const [clock, setClock] = useState(Date.now);
  const nextCheck = quotaWaitUntil(file, quota);
  const cooling = nextCheck > clock;
  useInterval(() => setClock(Date.now()), cooling ? 1000 : null);
  const status = quota?.status ?? 'idle';
  const loading = status === 'loading';
  const claudeReset = useClaudeResetGrants(
    file,
    entry.type === 'claude' && status !== 'idle',
    !canRefresh || loading || resetting,
    quota,
    onRefresh
  );
  const providerType =
    entry.type === 'plugin'
      ? String(
          file.quotaProvider ?? file['quota_provider'] ?? file.provider ?? file.type ?? 'plugin'
        )
      : entry.type;
  const iconSrc = getAuthFileIcon(providerType, resolvedTheme);
  const typeLabel = getTypeLabel(t, providerType);
  const errorMessage = resolveQuotaErrorMessage(
    t,
    quota?.errorStatus,
    quota?.error || t('common.unknown_error')
  );
  // Claude banked resets join the plan chip row; their expiry list follows it.
  const showClaudeReset = entry.type === 'claude' && status === 'success';
  const claudePlanItems = showClaudeReset ? (
    <span className={quotaClasses.codexPlanItem}>
      <span className={quotaClasses.codexPlanLabel}>{t('claude_reset.remaining')}</span>
      <span className={quotaClasses.codexPlanValue}>{claudeReset.count ?? '--'}</span>
    </span>
  ) : undefined;
  const claudeAfterPlan = showClaudeReset ? (
    <>
      <ClaudeResetGrantDetails grants={claudeReset.grants} classes={quotaClasses} />
      {claudeReset.message && (
        <div role="status" className={quotaClasses.codexResetCreditsError}>
          {t(`claude_reset.${claudeReset.message}`)}
        </div>
      )}
    </>
  ) : undefined;
  const creditOverage = useCodexCreditOverage(
    file,
    entry.type === 'codex' ? (quota as CodexQuotaState | undefined) : undefined,
    !canRefresh || loading || resetting
  );
  const codexAfterPlan = creditOverage.visible ? (
    <CodexCreditOverageRow
      entry={creditOverage.entry}
      classes={quotaClasses}
      disabled={creditOverage.blocked}
      name={displayName}
      onManage={creditOverage.openDialog}
    />
  ) : undefined;
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
      className={`${styles.card} ${mountEntranceDelayMs === null ? '' : styles.cardEnter} ${
        glance ? styles.cardGlance : ''
      }`}
      style={entranceStyle}
      data-quota-glance={glance ? '' : undefined}
    >
      <header className={styles.head}>
        <span
          className={styles.iconWrap}
          title={typeLabel}
          style={
            isThemeSurfaceIconProvider(providerType)
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
        <span className={styles.fileName} title={displayName}>
          {displayName}
        </span>
        {glance !== undefined && (
          <button
            type="button"
            className={styles.glanceToggle}
            onClick={onToggleGlance}
            aria-expanded={!glance}
            aria-label={`${t(glance ? 'card_layout.show_details' : 'card_layout.hide_details')}: ${displayName}`}
            title={t(glance ? 'card_layout.show_details' : 'card_layout.hide_details')}
          >
            <IconChevronDown size={14} />
          </button>
        )}
      </header>

      <div className={styles.body}>
        {cooling && (
          <div role="status" className={styles.idleHint}>
            {t('quota_management.next_check', { time: new Date(nextCheck).toLocaleString() })}
          </div>
        )}
        {quota?.backendQuota && (
          <BackendQuotaBody quota={quota.backendQuota} classes={quotaClasses} />
        )}
        {status === 'idle' ? (
          <button
            type="button"
            className={styles.idleBody}
            onClick={onRefresh}
            disabled={!canRefresh || cooling}
          >
            <IconRefreshCw size={15} aria-hidden="true" className={styles.idleGlyph} />
            <span className={styles.idleHint}>{t(`${adapter.i18nPrefix}.idle`)}</span>
          </button>
        ) : loading && !retainedClaudeUsage ? (
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
          quota.backendQuota ? (
            quota.hasManualQuota ? (
              <details>
                <summary>{t('quota_management.manual_details')}</summary>
                <adapter.Body quota={quota} classes={quotaClasses} planItems={claudePlanItems} afterPlan={entry.type === 'codex' ? codexAfterPlan : claudeAfterPlan} />
              </details>
            ) : null
          ) : (
            <adapter.Body quota={quota} classes={quotaClasses} planItems={claudePlanItems} afterPlan={entry.type === 'codex' ? codexAfterPlan : claudeAfterPlan} />
          )
        ) : (
          <div className={styles.idleHint}>{t(`${adapter.i18nPrefix}.idle`)}</div>
        )}
        {loading && retainedClaudeUsage && (
          <div role="status" aria-busy="true" className={quotaClasses.quotaMessage}>
            {t(`${adapter.i18nPrefix}.loading`)}
          </div>
        )}
        {retainedClaudeUsage && quota && (
          <adapter.Body
            quota={quota}
            classes={quotaClasses}
            planItems={claudePlanItems}
            afterPlan={claudeAfterPlan}
          />
        )}
      </div>

      {(usageCost || status !== 'idle') && !glance && (
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
          {entry.type === 'claude' && (
            <button
              type="button"
              className={styles.actionPill}
              disabled={claudeReset.blocked}
              onClick={claudeReset.openDialog}
              aria-haspopup="dialog"
              title={t(`claude_reset.${claudeReset.buttonLabel}`)}
            >
              <IconRefreshCw size={13} className={claudeReset.busy ? styles.spinning : undefined} />
              {t(`claude_reset.${claudeReset.buttonLabel}`)}
            </button>
          )}
            <button
              type="button"
              className={styles.refreshButton}
              onClick={onRefresh}
              disabled={isQuotaRefreshDisabled(canRefresh && !cooling, loading, resetting || claudeReset.busy)}
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
      {entry.type === 'claude' && (
        <ClaudeResetGrantDialog
          open={claudeReset.open}
          grants={claudeReset.grants}
          selected={claudeReset.selected}
          canRedeemGrant={claudeReset.canRedeemGrant}
          onSelect={claudeReset.selectGrant}
          busy={claudeReset.busy}
          loading={claudeReset.loading}
          pendingGrantId={claudeReset.pendingGrantId}
          message={claudeReset.message}
          name={displayName}
          onConfirm={() => void claudeReset.confirm()}
          onClose={claudeReset.closeDialog}
        />
      )}
      {creditOverage.context && (
        <CodexCreditOverageDialog
          open={creditOverage.open}
          context={creditOverage.context}
          entry={creditOverage.entry}
          operation={creditOverage.operation}
          writeDisabled={creditOverage.writeDisabled}
          contextCurrent={creditOverage.contextCurrent}
          sharedCredentialCount={creditOverageSharedCount}
          selection={creditOverage.selection}
          pendingTarget={creditOverage.pendingTarget}
          feedback={creditOverage.feedback}
          onSelect={creditOverage.selectValue}
          onSave={() => void creditOverage.save()}
          onClose={creditOverage.closeDialog}
        />
      )}
    </article>
  );
}

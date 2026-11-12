import { useTranslation } from 'react-i18next';
import { useNow } from '@/hooks/useNow';
import { buildResetDisplay } from '@/utils/quota';
import type { QuotaClassMap } from '../types';
import { backendQuotaState, type BackendQuota } from '../backendQuota';
import { QuotaMeter } from './QuotaMeter';
import { QuotaResetLabel } from './QuotaResetLabel';

export function BackendQuotaBody({
  quota,
  classes,
}: {
  quota: BackendQuota;
  classes: QuotaClassMap;
}) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const state = backendQuotaState(quota, now);
  return (
    <>
      <div className={classes.quotaMessage} role="status">
        {t(`quota_management.snapshot_${state}`)}
      </div>
      {quota.windows.map((window, index) => {
        const remaining = Math.max(0, Math.min(100, 100 - window.usedPercent));
        const reset = buildResetDisplay('', window.resetAtMs, now, i18n.resolvedLanguage);
        return (
          <div key={window.id} className={classes.quotaRow}>
            <div className={classes.quotaRowHeader}>
              <span className={classes.quotaModel}>{window.label}</span>
              <div className={classes.quotaMeta}>
                <span className={classes.quotaPercent}>
                  {t('quota_management.remaining_percent', {
                    percent: Math.round(remaining * 10) / 10,
                  })}
                </span>
                {reset && <QuotaResetLabel display={reset} classes={classes} />}
              </div>
            </div>
            <QuotaMeter percent={remaining} classes={classes} index={index} />
            <div className={classes.quotaMessage}>
              {window.observedAtMs === null
                ? t('quota_management.snapshot_time_unknown')
                : t('quota_management.snapshot_observed', {
                    time: new Date(window.observedAtMs).toLocaleString(i18n.resolvedLanguage),
                  })}
            </div>
          </div>
        );
      })}
    </>
  );
}

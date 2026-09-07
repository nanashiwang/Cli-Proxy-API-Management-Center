import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthFileItem, CodexQuotaState } from '@/types';
import { useNow } from '@/hooks/useNow';
import {
  buildCapacityAccounts,
  estimateCapacity,
  readCapacityHistory,
  recordCapacitySamples,
  writeCapacityHistory,
  type CapacityGroupEstimate,
} from '../capacityEstimate';
import styles from './QuotaCapacitySummary.module.scss';

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

interface Props {
  server: string;
  files: AuthFileItem[];
  quota: Record<string, CodexQuotaState>;
  enabled: boolean;
  visible: boolean;
}

/** Mount with a server key so switching servers cannot carry observations across pools. */
export function QuotaCapacitySummary({ server, files, quota, enabled, visible }: Props) {
  const now = useNow(enabled);
  const [history, setHistory] = useState(() => readCapacityHistory(server, browserStorage()));
  const accounts = useMemo(() => buildCapacityAccounts(files, quota), [files, quota]);
  const observations = useMemo(
    () => (enabled ? recordCapacitySamples(history, accounts, now) : history),
    [enabled, history, accounts, now]
  );
  useEffect(() => {
    if (observations === history) return;
    setHistory(observations);
    writeCapacityHistory(server, observations, browserStorage());
  }, [observations, history, server]);
  const groups = useMemo(
    () => estimateCapacity(accounts, observations, now),
    [accounts, observations, now]
  );
  if (!visible || !enabled || !accounts.length) return null;
  return <QuotaCapacityPanel groups={groups} />;
}

/** Separate presentation from collection to keep empty/error/numeric states testable. */
export function QuotaCapacityPanel({ groups }: { groups: CapacityGroupEstimate[] }) {
  const { t, i18n } = useTranslation();
  const number = (value: number | null, digits = 1) =>
    value === null
      ? '—'
      : new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: digits }).format(
          value
        );
  const hours = (value: number | null) =>
    value === null ? '—' : t('quota_management.capacity.hours', { value: number(value) });

  return (
    <section className={styles.panel} aria-label={t('quota_management.capacity.title')}>
      <header className={styles.header}>
        <div>
          <h3>{t('quota_management.capacity.title')}</h3>
          <p>{t('quota_management.capacity.subtitle')}</p>
        </div>
        <span className={styles.badge}>{t('quota_management.capacity.local')}</span>
      </header>
      {groups.map((group) => (
        <article className={styles.group} key={group.plan}>
          <div className={styles.groupHeader}>
            <strong>
              Codex ·{' '}
              {group.plan === 'unknown' ? t('quota_management.capacity.unknown_plan') : group.plan}
            </strong>
            <span>{t('quota_management.capacity.accounts', { count: group.accounts })}</span>
          </div>
          {group.status === 'ready' ? (
            <div className={styles.recommendations}>
              <div>
                <span>{t('quota_management.capacity.bridge')}</span>
                <strong>
                  {t('quota_management.capacity.add', { count: group.bridgeAccounts! })}
                </strong>
              </div>
              <div>
                <span>{t('quota_management.capacity.long_term')}</span>
                <strong>
                  {t('quota_management.capacity.add', { count: group.additionalAccounts! })}
                </strong>
              </div>
            </div>
          ) : (
            <p className={styles.status} role="status">
              {t(`quota_management.capacity.status_${group.status}`)}
            </p>
          )}
          {group.status === 'ready' && group.limitedAccounts > 0 && (
            <p className={styles.status}>{t('quota_management.capacity.partial_limit')}</p>
          )}
          {group.windows.length > 0 && (
            <div className={styles.scroll}>
              <table>
                <thead>
                  <tr>
                    <th>{t('quota_management.capacity.window')}</th>
                    <th>{t('quota_management.capacity.sampled')}</th>
                    <th>{t('quota_management.capacity.rate')}</th>
                    <th>{t('quota_management.capacity.runway')}</th>
                    <th>{t('quota_management.capacity.reset')}</th>
                    <th>{t('quota_management.capacity.total_needed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.windows.map((window) => (
                    <tr key={window.id}>
                      <td>{hours(window.periodHours)}</td>
                      <td>
                        {window.sampledAccounts}/{group.accounts}
                      </td>
                      <td>{number(window.rate)}</td>
                      <td>{hours(window.runwayHours)}</td>
                      <td>{hours(window.recoveryHours)}</td>
                      <td>{group.status === 'ready' ? number(window.requiredAccounts, 0) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ))}
      <p className={styles.note}>{t('quota_management.capacity.caveat')}</p>
      <details className={styles.formulas}>
        <summary>{t('quota_management.capacity.method')}</summary>
        <p>{t('quota_management.capacity.formulas')}</p>
        <p>{t('quota_management.capacity.sampling')}</p>
      </details>
    </section>
  );
}

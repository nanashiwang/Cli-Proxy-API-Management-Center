import { useTranslation } from 'react-i18next';
import type { ExecutionCapacity } from '@/types/authFile';
import { executionCapacityFull } from '../executionCapacity';
import styles from './AuthFileCapacity.module.scss';

export function AuthFileCapacity({ capacity }: { capacity?: ExecutionCapacity }) {
  const { t, i18n } = useTranslation();
  const limit = capacity?.unlimited
    ? t('auth_files.capacity.unlimited')
    : capacity?.limit != null
      ? capacity.limit.toLocaleString(i18n.language)
      : t('auth_files.capacity.unknown');
  return (
    <details className={`${styles.capacity} ${executionCapacityFull(capacity) ? styles.full : ''}`}>
      <summary>
        <span>{t('auth_files.capacity.label')}</span>
        <span className={styles.value}>
          {capacity ? capacity.active.toLocaleString(i18n.language) : '—'} / {limit}
          {executionCapacityFull(capacity) && <span> · {t('auth_files.capacity.full')}</span>}
        </span>
      </summary>
      <p>{t(capacity ? 'auth_files.capacity.description' : 'auth_files.capacity.unavailable')}</p>
      {capacity && (
        <p>
          {t('auth_files.capacity.observed', {
            time: new Date(capacity.observedAt).toLocaleTimeString(i18n.language),
          })}
        </p>
      )}
    </details>
  );
}

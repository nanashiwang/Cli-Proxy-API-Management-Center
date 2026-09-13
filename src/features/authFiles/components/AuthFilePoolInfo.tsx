import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { AuthFileItem } from '@/types';
import type { AccountPoolCredential, AccountPoolsResponse } from '@/services/api/accountPools';
import { accountPoolsApi } from '@/services/api/accountPools';
import { moveCredentials } from '@/features/accountPools/model';
import {
  indexPoolCredentials,
  poolKeyAccess,
  poolKeyConfigured,
  poolLeaseState,
} from '../poolAccess';
import styles from './AuthFilePoolInfo.module.scss';

export function AuthFilePoolInfo({
  file,
  data,
  credential,
  loading,
  now,
  onInspect,
}: {
  file: AuthFileItem;
  data: AccountPoolsResponse | null;
  credential?: AccountPoolCredential;
  loading: boolean;
  now: number;
  onInspect: (file: AuthFileItem) => void;
}) {
  const { t } = useTranslation();
  const group = data?.config.groups.find((g) => g.id === credential?.['group-id']);
  const state =
    data && credential
      ? poolLeaseState(data, credential['group-id'], now, credential.id)
      : 'unknown';
  const lease = data?.leases?.find(
    (l) =>
      l['group-id'] === group?.id && (!l['credential-id'] || l['credential-id'] === credential?.id)
  );
  return (
    <div className={styles.block}>
      <div className={styles.row}>
        <span className={styles.name}>
          {t('auth_pool.group')}:{' '}
          {group?.name ?? t(loading ? 'auth_pool.loading' : 'auth_pool.unknown')}
        </span>
        <span className={styles.muted}>{t(`auth_pool.state_${state}`)}</span>
      </div>
      {group?.disabled && <span className={styles.warning}>{t('auth_pool.group_disabled')}</span>}
      {lease && (
        <span className={styles.muted}>
          {t('auth_pool.expires', {
            time: new Date(lease['expires-at']).toLocaleString(),
            count: lease.active,
          })}
        </span>
      )}
      <div className={styles.row}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onInspect(file)}
          disabled={!credential || loading}
        >
          {t('auth_pool.inspect')}
        </Button>
      </div>
    </div>
  );
}

export function AuthFilePoolDialog({
  file,
  data,
  refresh,
  onClose,
  disabled,
}: {
  file: AuthFileItem;
  data: AccountPoolsResponse | null;
  refresh: () => Promise<AccountPoolsResponse | null>;
  onClose: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const credential = useMemo(() => indexPoolCredentials(data)(file), [data, file]);
  const current = credential?.['group-id'] ?? '';
  const [target, setTarget] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const group = data?.config.groups.find((g) => g.id === current);
  const move = async () => {
    if (!data || !credential || !target || saving || disabled) return;
    setSaving(true);
    setError('');
    try {
      await accountPoolsApi.save(
        moveCredentials(data.config, [credential.id], target),
        data.revision
      );
      const updated = await refresh();
      if (!updated) {
        setError(t('auth_pool.saved_refresh_failed'));
        return;
      }
      onClose();
    } catch (e) {
      setError(`${t('auth_pool.move_failed')}${e instanceof Error ? `: ${e.message}` : ''}`);
      await refresh();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      title={t('auth_pool.dialog_title', { name: file.email || file.name })}
      onClose={onClose}
      closeDisabled={saving}
      footer={
        <Button
          onClick={() => void move()}
          loading={saving}
          disabled={
            disabled ||
            saving ||
            !credential ||
            !target ||
            target === current ||
            !data?.config.groups.some((g) => g.id === target)
          }
        >
          {t('auth_pool.move')}
        </Button>
      }
    >
      {!data || !credential ? (
        <p>{t('auth_pool.unknown')}</p>
      ) : (
        <>
          <p>
            {t('auth_pool.group')}: <strong>{group?.name ?? t('auth_pool.unknown')}</strong>
          </p>
          {!data.config.enabled && <p className={styles.warning}>{t('auth_pool.off_hint')}</p>}
          {(file.disabled === true || (file.disabled === undefined && credential.disabled)) && (
            <p className={styles.warning}>{t('auth_pool.disabled_hint')}</p>
          )}
          <p className={styles.muted}>{t('auth_pool.access_hint')}</p>
          <ul className={styles.keys}>
            {data.keys.map((key) => (
              <li className={styles.key} key={key['key-hash']}>
                <span>
                  {key.name || `Key ${key.index}`} · <code>{key.preview}</code>
                </span>
                <span>
                  {t('auth_pool.configured')}:{' '}
                  {t(poolKeyConfigured(data, credential, key) ? 'auth_pool.yes' : 'auth_pool.no')}
                  <br />
                  {t(`auth_pool.access_${poolKeyAccess(data, credential, file, key)}`)}
                </span>
              </li>
            ))}
          </ul>
          {data.keys.length === 0 && <p>{t('auth_pool.no_keys')}</p>}
          <label className={styles.row}>
            {t('auth_pool.move_to')}
            <select
              className={styles.select}
              value={target}
              disabled={disabled || saving}
              onChange={(e) => setTarget(e.target.value)}
            >
              {data.config.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.disabled ? ` (${t('auth_pool.group_disabled')})` : ''}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.muted}>{t('auth_pool.move_hint')}</p>
        </>
      )}
      {error && (
        <p role="alert" className={styles.warning}>
          {error}
        </p>
      )}
    </Modal>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useAuthStore, useNotificationStore } from '@/stores';
import {
  accountPoolsApi,
  type AccountPoolsConfig,
  type AccountPoolsResponse,
} from '@/services/api/accountPools';
import {
  DEFAULT_GROUP,
  effectiveCredentials,
  membership,
  moveCredentials,
  ruleFor,
  setKeyRule,
} from './model';
import styles from './AccountPoolsPage.module.scss';

export function AccountPoolsPage() {
  const { t } = useTranslation();
  const apiBase = useAuthStore((state) => state.apiBase);
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);
  const loadSequence = useRef(0);
  const notify = useNotificationStore((state) => state.showNotification);
  const [data, setData] = useState<AccountPoolsResponse | null>(null);
  const [draft, setDraft] = useState<AccountPoolsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [memberGroup, setMemberGroup] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const members = useMemo(() => (draft ? membership(draft) : new Map<string, string>()), [draft]);
  const dirty = !!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data.config);

  useUnsavedChangesGuard({
    shouldBlock: dirty,
    dialog: {
      title: t('account_pools.unsaved'),
      message: t('account_pools.discard_hint'),
      confirmText: t('account_pools.discard'),
      cancelText: t('account_pools.cancel'),
    },
  });

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError('');
    try {
      const response = await accountPoolsApi.get();
      if (sequence !== loadSequence.current) return;
      setData(response);
      setDraft(response.config);
    } catch (e) {
      if (sequence === loadSequence.current)
        setError(`${t('account_pools.load_error')}${e instanceof Error ? `: ${e.message}` : ''}`);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    setData(null);
    setDraft(null);
    void load();
    return () => {
      loadSequence.current++;
    };
  }, [apiBase, load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    if (!draft || !data) return;
    setSaving(true);
    setError('');
    try {
      await accountPoolsApi.save(draft, data.revision);
      notify(t('account_pools.saved'), 'success');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('account_pools.save_error'));
    } finally {
      setSaving(false);
    }
  };

  const addGroup = () => {
    if (!draft || !newName.trim()) return;
    setDraft({
      ...draft,
      groups: [
        ...draft.groups,
        {
          id: crypto.randomUUID(),
          name: newName.trim(),
          'credential-ids': [],
        },
      ],
    });
    setNewName('');
    setAdding(false);
  };

  const openMembers = (id: string) => {
    setMemberGroup(id);
    setSelectedIds([]);
    setSearch('');
  };

  const busy = loading || saving;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>{t('account_pools.title')}</h1>
          <p>{t('account_pools.subtitle')}</p>
        </div>
        <div className={styles.actions}>
          {dirty && <span className={styles.pending}>{t('account_pools.unsaved')}</span>}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (!dirty) {
                void load();
                return;
              }
              showConfirmation({
                title: t('account_pools.unsaved'),
                message: t('account_pools.discard_hint'),
                confirmText: t('account_pools.discard'),
                cancelText: t('account_pools.cancel'),
                onConfirm: load,
              });
            }}
          >
            {t('account_pools.reload')}
          </Button>
          <Button
            disabled={busy || !dirty || !draft?.groups.every((g) => g.name.trim())}
            onClick={() => void save()}
          >
            {saving ? t('account_pools.saving') : t('account_pools.save')}
          </Button>
        </div>
      </header>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {loading && !data && <p role="status">{t('account_pools.loading')}</p>}
      {data && draft && (
        <>
          <section className={styles.banner}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={draft.enabled}
                disabled={busy || data['home-enabled']}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              />
              <strong>{t('account_pools.enable')}</strong>
            </label>
            <p>{t(draft.enabled ? 'account_pools.enabled_hint' : 'account_pools.disabled_hint')}</p>
            {data['home-enabled'] && (
              <p className={styles.warning}>{t('account_pools.home_hint')}</p>
            )}
            {draft.enabled && <p className={styles.muted}>{t('account_pools.protocol_hint')}</p>}
          </section>
          <section>
            <div className={styles.sectionHeader}>
              <h2>
                {t('account_pools.groups')} <span>{draft.groups.length}</span>
              </h2>
              <Button size="sm" disabled={busy} onClick={() => setAdding(true)}>
                {t('account_pools.add_group')}
              </Button>
            </div>
            <div className={styles.grid}>
              {draft.groups.map((group) => {
                const accounts = data.credentials.filter(
                  (a) => (members.get(a.id) ?? DEFAULT_GROUP) === group.id
                );
                const keyCount = data.keys.filter((key) => {
                  const rule = ruleFor(draft, key['key-hash']);
                  return (
                    (rule['lease-instance'] ? group.lease === true : !group.lease) &&
                    (rule.scope === 'all' || rule['group-ids'].includes(group.id))
                  );
                }).length;
                const referenced = draft['key-rules'].some(
                  (rule) => rule.scope === 'selected' && rule['group-ids'].includes(group.id)
                );
                return (
                  <article className={styles.card} key={group.id}>
                    <div className={styles.cardHeading}>
                      <input
                        className={styles.groupName}
                        aria-label={t('account_pools.group_name')}
                        value={group.name}
                        disabled={busy}
                        maxLength={80}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            groups: draft.groups.map((g) =>
                              g.id === group.id ? { ...g, name: e.target.value } : g
                            ),
                          })
                        }
                      />
                      {group.id === DEFAULT_GROUP && (
                        <span className={styles.badge}>{t('account_pools.default')}</span>
                      )}
                    </div>
                    <input
                      className={styles.description}
                      aria-label={t('account_pools.description')}
                      placeholder={t('account_pools.description')}
                      value={group.description ?? ''}
                      disabled={busy}
                      maxLength={200}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          groups: draft.groups.map((g) =>
                            g.id === group.id ? { ...g, description: e.target.value } : g
                          ),
                        })
                      }
                    />
                    {group.id !== DEFAULT_GROUP && (
                      <label className={styles.toggle}>
                        <input
                          type="checkbox"
                          checked={group.lease === true}
                          disabled={busy}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              groups: draft.groups.map((g) =>
                                g.id === group.id ? { ...g, lease: e.target.checked } : g
                              ),
                            })
                          }
                        />
                        {t('account_pools.lease_enabled')}
                      </label>
                    )}
                    {group.lease && (
                      <p className={styles.muted}>
                        {data['lease-error']
                          ? t('account_pools.lease_error')
                          : data.leases?.find((l) => l['group-id'] === group.id)
                            ? (() => {
                                const lease = data.leases!.find((l) => l['group-id'] === group.id)!;
                                return t('account_pools.lease_status', {
                                  owner: lease.owner.slice(0, 10),
                                  expires: new Date(lease['expires-at']).toLocaleString(),
                                  active: lease.active,
                                });
                              })()
                            : t('account_pools.lease_free')}
                      </p>
                    )}
                    <div className={styles.metrics}>
                      <div>
                        <strong>{accounts.length}</strong>
                        <span>{t('account_pools.accounts')}</span>
                      </div>
                      <div>
                        <strong>
                          {group.disabled
                            ? 0
                            : accounts.filter((a) => !a.disabled && !a.unavailable).length}
                        </strong>
                        <span>{t('account_pools.available')}</span>
                      </div>
                      <div>
                        <strong>
                          {accounts.filter((a) => !a.disabled && a.unavailable).length}
                        </strong>
                        <span>{t('account_pools.cooling')}</span>
                      </div>
                      <div>
                        <strong>{keyCount}</strong>
                        <span>{t('account_pools.keys')}</span>
                      </div>
                    </div>
                    <div className={styles.providers}>
                      {[...new Set(accounts.map((a) => a.provider))].map((provider) => (
                        <span className={styles.badge} key={provider}>
                          {provider} · {accounts.filter((a) => a.provider === provider).length}
                        </span>
                      ))}
                    </div>
                    <div className={styles.cardActions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => openMembers(group.id)}
                      >
                        {t('account_pools.assign')}
                      </Button>
                      <label className={styles.toggle}>
                        <input
                          type="checkbox"
                          checked={!group.disabled}
                          disabled={busy}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              groups: draft.groups.map((g) =>
                                g.id === group.id ? { ...g, disabled: !e.target.checked } : g
                              ),
                            })
                          }
                        />
                        {t('account_pools.group_enabled')}
                      </label>
                      {group.id !== DEFAULT_GROUP && (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy || referenced || group['credential-ids'].length > 0}
                          title={t('account_pools.delete_hint')}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              groups: draft.groups.filter((g) => g.id !== group.id),
                            })
                          }
                        >
                          {t('account_pools.delete')}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section>
            <div className={styles.sectionHeader}>
              <h2>{t('account_pools.key_permissions')}</h2>
              <Link to="/config">{t('account_pools.manage_keys')}</Link>
            </div>
            <p className={styles.muted}>{t('account_pools.all_hint')}</p>
            {data.keys.length === 0 && <p>{t('account_pools.no_keys')}</p>}
            <div className={styles.keyList}>
              {data.keys.map((key) => {
                const rule = ruleFor(draft, key['key-hash']);
                const allowed = effectiveCredentials(draft, rule, data.credentials);
                return (
                  <article className={styles.keyCard} key={key['key-hash']}>
                    <div className={styles.keyHeading}>
                      <div>
                        <input
                          aria-label={t('account_pools.key_name')}
                          placeholder={`Key ${key.index}`}
                          value={rule.name ?? ''}
                          disabled={busy}
                          onChange={(e) =>
                            setDraft(setKeyRule(draft, { ...rule, name: e.target.value }))
                          }
                        />
                        <code>{key.preview}</code>
                      </div>
                      <label>
                        {t('account_pools.scope')}
                        <select
                          aria-label={`${t('account_pools.scope')} Key ${key.index}`}
                          value={rule.scope}
                          disabled={busy}
                          onChange={(e) =>
                            setDraft(
                              setKeyRule(draft, {
                                ...rule,
                                scope: e.target.value as 'selected' | 'all',
                                'group-ids': [],
                              })
                            )
                          }
                        >
                          <option value="selected">{t('account_pools.selected')}</option>
                          <option value="all">{t('account_pools.all')}</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      {t('account_pools.lease_instance')}
                      <input
                        aria-label={`${t('account_pools.lease_instance')} Key ${key.index}`}
                        value={rule['lease-instance'] ?? ''}
                        disabled={busy}
                        maxLength={64}
                        placeholder="newapi-main"
                        onChange={(e) =>
                          setDraft(setKeyRule(draft, { ...rule, 'lease-instance': e.target.value }))
                        }
                      />
                    </label>
                    <p className={styles.muted}>{t('account_pools.lease_hint')}</p>
                    <div className={styles.groupChoices}>
                      {draft.groups.map((group) => (
                        <label className={styles.choice} key={group.id}>
                          <input
                            type="checkbox"
                            checked={rule.scope === 'all' || rule['group-ids'].includes(group.id)}
                            disabled={busy || rule.scope === 'all'}
                            onChange={(e) =>
                              setDraft(
                                setKeyRule(draft, {
                                  ...rule,
                                  'group-ids': e.target.checked
                                    ? [...rule['group-ids'], group.id]
                                    : rule['group-ids'].filter((id) => id !== group.id),
                                })
                              )
                            }
                          />
                          {group.name}
                          {group.disabled && (
                            <span className={styles.muted}> · {t('account_pools.paused')}</span>
                          )}
                        </label>
                      ))}
                    </div>
                    <p className={allowed.length ? styles.muted : styles.warning}>
                      {t('account_pools.effective', { count: allowed.length })}
                      {rule.scope === 'selected' && rule['group-ids'].length === 0
                        ? ` · ${t('account_pools.no_access')}`
                        : ''}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
      <Modal
        open={adding}
        title={t('account_pools.add_group')}
        onClose={() => setAdding(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              {t('account_pools.cancel')}
            </Button>
            <Button disabled={!newName.trim()} onClick={addGroup}>
              {t('account_pools.add')}
            </Button>
          </>
        }
      >
        <label className={styles.field}>
          {t('account_pools.group_name')}
          <input
            value={newName}
            maxLength={80}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('account_pools.name_example')}
            autoFocus
          />
        </label>
      </Modal>
      <Modal
        open={memberGroup !== null}
        width={720}
        title={`${t('account_pools.assign')} · ${draft?.groups.find((g) => g.id === memberGroup)?.name ?? ''}`}
        onClose={() => setMemberGroup(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMemberGroup(null)}>
              {t('account_pools.cancel')}
            </Button>
            <Button
              disabled={!selectedIds.length}
              onClick={() => {
                if (draft && memberGroup)
                  setDraft(moveCredentials(draft, selectedIds, memberGroup));
                setMemberGroup(null);
              }}
            >
              {t('account_pools.move_selected', { count: selectedIds.length })}
            </Button>
          </>
        }
      >
        <p className={styles.muted}>{t('account_pools.move_hint')}</p>
        <input
          className={styles.search}
          aria-label={t('account_pools.search')}
          placeholder={t('account_pools.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className={styles.accountList}>
          {data?.credentials
            .filter((a) => `${a.name} ${a.provider}`.toLowerCase().includes(search.toLowerCase()))
            .map((account) => {
              const group = draft?.groups.find(
                (g) => g.id === (members.get(account.id) ?? DEFAULT_GROUP)
              );
              return (
                <label className={styles.accountRow} key={account.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(account.id)}
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked
                          ? [...selectedIds, account.id]
                          : selectedIds.filter((id) => id !== account.id)
                      )
                    }
                  />
                  <span>
                    <strong>{account.name}</strong>
                    <small>
                      {account.provider} · {group?.name}
                      {account.disabled ? ` · ${t('account_pools.paused')}` : ''}
                    </small>
                  </span>
                </label>
              );
            })}
        </div>
      </Modal>
    </div>
  );
}

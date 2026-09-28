import { useTranslation } from 'react-i18next';
import type { UsageRecordColumn } from './recordPresentation';
import type { ColumnPreferences } from './columnPreferences';
import { normalizeColumnPreferences } from './columnPreferences';
import styles from './UsagePage.module.scss';

export function UsageColumnSettings({
  value,
  onChange,
}: {
  value: ColumnPreferences;
  onChange: (value: ColumnPreferences) => void;
}) {
  const { t } = useTranslation();
  const update = (next: ColumnPreferences) => onChange(normalizeColumnPreferences(next));
  const move = (key: UsageRecordColumn, direction: number) => {
    const order = [...value.order];
    const index = order.indexOf(key);
    const target = index + direction;
    if (target < 0 || target >= order.length - 1) return;
    [order[index], order[target]] = [order[target], order[index]];
    update({ ...value, order });
  };
  return (
    <details className={styles.columnSettings}>
      <summary>{t('usage_stats.columns.title')}</summary>
      <p className={styles.detailNote}>{t('usage_stats.columns.hint')}</p>
      <div className={styles.columnOptions}>
        {value.order
          .filter((key) => key !== 'actions')
          .map((key, index) => {
            const label = t(`usage_stats.${key}`);
            const pinned = value.pinned.includes(key);
            return (
              <div key={key} className={styles.columnOption}>
                <label>
                  <input
                    type="checkbox"
                    checked={!value.hidden.includes(key)}
                    onChange={(event) =>
                      update({
                        ...value,
                        hidden: event.target.checked
                          ? value.hidden.filter((k) => k !== key)
                          : [...value.hidden, key],
                        pinned: event.target.checked
                          ? value.pinned
                          : value.pinned.filter((k) => k !== key),
                      })
                    }
                  />
                  {label}
                </label>
                <button
                  type="button"
                  aria-label={t('usage_stats.columns.up', { column: label })}
                  disabled={index === 0}
                  onClick={() => move(key, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={t('usage_stats.columns.down', { column: label })}
                  disabled={index === value.order.length - 2}
                  onClick={() => move(key, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={t('usage_stats.columns.pin_label', { column: label })}
                  aria-pressed={pinned}
                  disabled={!pinned && value.pinned.length >= 2}
                  onClick={() =>
                    update({
                      ...value,
                      pinned: pinned
                        ? value.pinned.filter((k) => k !== key)
                        : [...value.pinned, key],
                    })
                  }
                >
                  {t(pinned ? 'usage_stats.columns.unpin' : 'usage_stats.columns.pin')}
                </button>
              </div>
            );
          })}
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => update(normalizeColumnPreferences(null))}
      >
        {t('usage_stats.columns.reset')}
      </button>
    </details>
  );
}

import { USAGE_RECORD_COLUMNS, type UsageRecordColumn } from './recordPresentation';

export const USAGE_COLUMNS_STORAGE_KEY = 'cpa.usage.columns.v1';
export type ColumnPreferences = {
  order: UsageRecordColumn[];
  hidden: UsageRecordColumn[];
  pinned: UsageRecordColumn[];
};
export function normalizeColumnPreferences(value: unknown): ColumnPreferences {
  const input = value && typeof value === 'object' ? (value as Partial<ColumnPreferences>) : {};
  const columns = (items: unknown): UsageRecordColumn[] =>
    Array.isArray(items)
      ? [
          ...new Set(
            items.filter(
              (item): item is UsageRecordColumn =>
                USAGE_RECORD_COLUMNS.includes(item as UsageRecordColumn) && item !== 'actions'
            )
          ),
        ]
      : [];
  const requested = columns(input.order);
  const order = [
    ...requested,
    ...USAGE_RECORD_COLUMNS.filter((key) => key !== 'actions' && !requested.includes(key)),
    'actions',
  ] as UsageRecordColumn[];
  const pinned = columns(input.pinned).slice(0, 2);
  return { order, pinned, hidden: columns(input.hidden).filter((key) => !pinned.includes(key)) };
}
export function visibleRecordColumns(preferences: ColumnPreferences): UsageRecordColumn[] {
  return [
    ...preferences.order.filter((key) => preferences.pinned.includes(key)),
    ...preferences.order.filter(
      (key) => !preferences.pinned.includes(key) && !preferences.hidden.includes(key)
    ),
  ];
}
export function readColumnPreferences(): ColumnPreferences {
  try {
    return normalizeColumnPreferences(
      JSON.parse(localStorage.getItem(USAGE_COLUMNS_STORAGE_KEY) || 'null')
    );
  } catch {
    return normalizeColumnPreferences(null);
  }
}

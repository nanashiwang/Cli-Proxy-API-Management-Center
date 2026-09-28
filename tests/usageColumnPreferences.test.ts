import { expect, test } from 'bun:test';
import {
  normalizeColumnPreferences,
  visibleRecordColumns,
} from '../src/features/usage/columnPreferences';
import { USAGE_RECORD_COLUMNS } from '../src/features/usage/recordPresentation';
test('migrates invalid or obsolete preferences without losing fields or actions', () => {
  expect(visibleRecordColumns(normalizeColumnPreferences(null))).toEqual([...USAGE_RECORD_COLUMNS]);
  const p = normalizeColumnPreferences({
    order: ['tokens', 'tokens', 'removed'],
    hidden: ['account', 'actions'],
    pinned: ['model', 'cost', 'tokens'],
  });
  expect(p.order[0]).toBe('tokens');
  expect(p.order.at(-1)).toBe('actions');
  expect(new Set(p.order).size).toBe(USAGE_RECORD_COLUMNS.length);
  expect(p.pinned).toEqual(['model', 'cost']);
  expect(visibleRecordColumns(p)).not.toContain('account');
  expect(visibleRecordColumns(p).slice(0, 2)).toEqual(['model', 'cost']);
  expect(visibleRecordColumns(p)).toContain('actions');
  expect(normalizeColumnPreferences(JSON.parse(JSON.stringify(p)))).toEqual(p);
});

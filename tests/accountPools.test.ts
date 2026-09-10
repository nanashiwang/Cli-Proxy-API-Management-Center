import { describe, expect, test } from 'bun:test';
import type { AccountPoolsConfig, AccountPoolCredential } from '../src/services/api/accountPools';
import {
  effectiveCredentials,
  membership,
  moveCredentials,
  ruleFor,
} from '../src/features/accountPools/model';
const config = (): AccountPoolsConfig => ({
  enabled: true,
  groups: [
    { id: 'default', name: 'Default', 'credential-ids': [] },
    { id: 'a', name: 'A', 'credential-ids': ['one'] },
    { id: 'b', name: 'B', 'credential-ids': ['two'] },
  ],
  'key-rules': [],
});
const accounts: AccountPoolCredential[] = ['one', 'two', 'three'].map((id) => ({
  id,
  name: id,
  provider: 'codex',
  disabled: false,
  unavailable: false,
  'group-id': 'default',
}));

describe('account groups', () => {
  test('moving accounts updates both groups without duplication', () => {
    const original = config();
    const moved = moveCredentials(original, ['one', 'one'], 'b');
    expect(moved.groups[1]['credential-ids']).toEqual([]);
    expect(moved.groups[2]['credential-ids']).toEqual(['two', 'one']);
    expect(original.groups[1]['credential-ids']).toEqual(['one']);
    expect(membership(moveCredentials(moved, ['one'], 'default')).has('one')).toBe(false);
  });
  test('unknown destination cannot remove an assignment', () => {
    const original = config();
    expect(moveCredentials(original, ['one'], 'unknown')).toBe(original);
  });
  test('legacy keys bind to the default group rather than all groups', () => {
    const c = config();
    expect(effectiveCredentials(c, ruleFor(c, 'legacy'), accounts).map((a) => a.id)).toEqual([
      'three',
    ]);
  });
  test('all includes new groups while selected and empty scopes remain restricted', () => {
    const c = config();
    c.groups.push({ id: 'future', name: 'Future', 'credential-ids': ['three'] });
    expect(
      effectiveCredentials(c, { 'key-hash': 'k', scope: 'all', 'group-ids': [] }, accounts)
    ).toHaveLength(3);
    expect(
      effectiveCredentials(
        c,
        { 'key-hash': 'k', scope: 'selected', 'group-ids': ['a'] },
        accounts
      ).map((a) => a.id)
    ).toEqual(['one']);
    expect(
      effectiveCredentials(c, { 'key-hash': 'k', scope: 'selected', 'group-ids': [] }, accounts)
    ).toHaveLength(0);
  });
  test('rename preserves bindings and disabled groups remove effective access', () => {
    const c = config();
    const rule = { 'key-hash': 'k', scope: 'selected' as const, 'group-ids': ['a'] };
    c.groups[1].name = '自定义名称';
    expect(effectiveCredentials(c, rule, accounts)).toHaveLength(1);
    c.groups[1].disabled = true;
    expect(effectiveCredentials(c, rule, accounts)).toHaveLength(0);
  });
});

test('lease keys only preview lease pools and ordinary all keys cannot use them', () => {
 const c = config(); c.groups[1].lease = true;
 const rule = {'key-hash': 'k', scope: 'all' as const, 'group-ids': []};
 expect(effectiveCredentials(c, rule, accounts).map(a => a.id)).toEqual(['two', 'three']);
 expect(effectiveCredentials(c, {...rule, 'lease-instance': 'newapi-main'}, accounts).map(a => a.id)).toEqual(['one']);
 const moved = moveCredentials(c, ['two'], 'a');
 expect(moved.groups[1].lease).toBe(true);
});

import { describe, expect, test } from 'bun:test';
import {
  indexPoolCredentials,
  poolKeyAccess,
  poolKeyConfigured,
  poolLeaseState,
} from '../src/features/authFiles/poolAccess';
import type { AccountPoolsResponse } from '../src/services/api/accountPools';
const data = (): AccountPoolsResponse => ({
  config: {
    enabled: true,
    groups: [
      { id: 'default', name: 'Default', 'credential-ids': [] },
      { id: 'private', name: 'Private', lease: true, 'credential-ids': ['id'] },
    ],
    'key-rules': [
      { 'key-hash': 'shared', scope: 'selected', 'group-ids': ['default'] },
      {
        'key-hash': 'private',
        scope: 'selected',
        'group-ids': ['private'],
        'lease-instance': 'newapi-main',
      },
    ],
  },
  credentials: [
    {
      id: 'id',
      name: 'account.json',
      provider: 'codex',
      disabled: false,
      unavailable: false,
      'group-id': 'private',
    },
  ],
  keys: [
    {
      'key-hash': 'shared',
      scope: 'selected',
      'group-ids': ['default'],
      index: 1,
      preview: 'sk-***one',
    },
    {
      'key-hash': 'private',
      scope: 'selected',
      'group-ids': ['private'],
      index: 2,
      preview: 'sk-***two',
    },
  ],
  leases: [],
  revision: 'v1',
  'home-enabled': false,
});
describe('auth file group access', () => {
  test('uses exact ID and never guesses default or email membership', () => {
    const d = data(),
      resolve = indexPoolCredentials(d);
    expect(resolve({ name: 'renamed.json', id: 'id' })?.['group-id']).toBe('private');
    expect(resolve({ name: 'account.json' })).toBe(d.credentials[0]);
    expect(resolve({ id: 'unknown', name: 'account.json' })).toBeUndefined();
    expect(resolve({ name: 'unknown.json', email: 'account.json' })).toBeUndefined();
    expect(indexPoolCredentials(null)({ name: 'account.json' })).toBeUndefined();
  });
  test('does not resolve ambiguous display names', () => {
    const d = data();
    d.credentials.push({ ...d.credentials[0], id: 'another' });
    expect(indexPoolCredentials(d)({ name: 'account.json' })).toBeUndefined();
  });
  test('disabled account has no callable key but retains configured authorization', () => {
    const d = data(),
      c = d.credentials[0],
      f = { id: 'id', name: c.name, disabled: true };
    expect(d.keys.map((k) => poolKeyAccess(d, c, f, k))).toEqual([
      'account_disabled',
      'account_disabled',
    ]);
    expect(d.keys.map((k) => poolKeyConfigured(d, c, k))).toEqual([false, true]);
  });
  test('disabled global switch allows all keys without losing configured group membership', () => {
    const d = data();
    d.config.enabled = false;
    expect(
      d.keys.map((k) => poolKeyAccess(d, d.credentials[0], { name: 'account.json' }, k))
    ).toEqual(['allowed', 'allowed']);
    expect(indexPoolCredentials(d)({ name: 'account.json' })?.['group-id']).toBe('private');
    expect(poolLeaseState(d, 'private', Date.now())).toBe('off');
  });
  test('lease and disabled group restrictions are shown separately', () => {
    const d = data(),
      c = d.credentials[0],
      f = { name: c.name };
    expect(poolKeyAccess(d, c, f, d.keys[0])).toBe('denied');
    expect(poolKeyAccess(d, c, f, d.keys[1])).toBe('lease_required');
    d.config.groups[1].disabled = true;
    expect(poolKeyAccess(d, c, f, d.keys[1])).toBe('group_disabled');
  });
  test('expired snapshots never assert that a pool is free', () => {
    const d = data();
    expect(poolLeaseState(d, 'private', 1000)).toBe('free');
    d.leases = [
      {
        id: 'lease',
        owner: 'hash',
        'group-id': 'private',
        'expires-at': new Date(2000).toISOString(),
        active: 1,
      },
    ];
    expect(poolLeaseState(d, 'private', 1000)).toBe('occupied');
    expect(poolLeaseState(d, 'private', 3000)).toBe('draining');
    d.leases[0].active = 0;
    expect(poolLeaseState(d, 'private', 3000)).toBe('unknown');
    delete d.leases;
    expect(poolLeaseState(d, 'private', 1000)).toBe('unknown');
  });
  test('backend lease errors do not appear as successful authorization', () => {
    const d = data();
    d['lease-error'] = 'unavailable';
    expect(poolKeyAccess(d, d.credentials[0], { name: 'account.json' }, d.keys[1])).toBe('unknown');
  });
});

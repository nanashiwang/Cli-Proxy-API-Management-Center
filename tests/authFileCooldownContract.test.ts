import { describe, expect, test } from 'bun:test';
import { normalizeAuthFilesResponse } from '../src/services/api/authFiles';
import { isProblemAuthFile } from '../src/features/authFiles/constants';
import { poolLeaseState } from '../src/features/authFiles/poolAccess';
import type { AccountPoolsResponse } from '../src/services/api/accountPools';

// API presentation recovery must not become client-side quota or lease recovery.
describe('cooldown availability contract', () => {
  test('clears the card warning only after the API reports recovery', () => {
    const response = (unavailable: boolean, message: string) =>
      normalizeAuthFilesResponse({
        files: [
          {
            name: 'account.json',
            type: 'codex',
            unavailable,
            status: unavailable ? 'error' : 'active',
            status_message: message,
          },
        ],
      }).files[0];
    expect(isProblemAuthFile(response(true, 'rate limit exceeded'))).toBe(true);
    expect(isProblemAuthFile(response(false, ''))).toBe(false);
    expect(isProblemAuthFile(response(true, 'unauthorized'))).toBe(true);
    expect(isProblemAuthFile(response(true, 'credential_quota'))).toBe(true);
  });

  test('an expired browser deadline does not clear an API error', () => {
    const file = normalizeAuthFilesResponse({
      files: [
        {
          name: 'account.json',
          status: 'error',
          unavailable: true,
          status_message: 'credential_quota',
          next_retry_after: '2020-01-01T00:00:00Z',
        },
      ],
    }).files[0];
    expect(isProblemAuthFile(file)).toBe(true);
  });

  test('recovered credentials retain occupied and draining lease badges', () => {
    const now = Date.parse('2026-09-21T00:00:00Z');
    const data: AccountPoolsResponse = {
      config: {
        enabled: true,
        groups: [{ id: 'private', name: 'Private', lease: true, 'credential-ids': ['account'] }],
        'key-rules': [],
      },
      credentials: [
        {
          id: 'account',
          name: 'account.json',
          provider: 'codex',
          disabled: false,
          unavailable: false,
          'group-id': 'private',
        },
      ],
      keys: [],
      revision: 'test',
      'home-enabled': false,
      leases: [
        {
          id: 'lease',
          'group-id': 'private',
          'credential-id': 'account',
          owner: 'test',
          'expires-at': '2026-09-22T00:00:00Z',
          active: 1,
        },
      ],
    };
    expect(poolLeaseState(data, 'private', now, 'account')).toBe('occupied');
    data.leases![0]['expires-at'] = '2026-09-20T00:00:00Z';
    expect(poolLeaseState(data, 'private', now, 'account')).toBe('draining');
  });
});

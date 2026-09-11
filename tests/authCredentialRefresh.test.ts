import { afterEach, expect, spyOn, test } from 'bun:test';
import { apiClient } from '@/services/api/client';
import { authFilesApi } from '@/services/api/authFiles';

let restore = () => {};
afterEach(() => restore());

test('manual refresh invokes the credential endpoint without overwriting expiry', async () => {
  const post = spyOn(apiClient, 'post').mockResolvedValue({ ok: true });
  restore = () => post.mockRestore();
  await authFilesApi.requestManualRefresh('account.json');
  expect(post).toHaveBeenCalledWith(
    '/auth-files/refresh',
    { name: 'account.json' },
    { timeout: 0 }
  );
});

test('bulk refresh preserves per-account failure results', async () => {
  const response = {
    ok: true,
    results: [
      { id: 'a', success: true },
      { id: 'b', success: false, error: 'revoked' },
    ],
  };
  const post = spyOn(apiClient, 'post').mockResolvedValue(response);
  restore = () => post.mockRestore();
  expect(await authFilesApi.refreshAll()).toEqual(response);
  expect(post).toHaveBeenCalledWith('/auth-files/refresh', { all: true }, { timeout: 0 });
});

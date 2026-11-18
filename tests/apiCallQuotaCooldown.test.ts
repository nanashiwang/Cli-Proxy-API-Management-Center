import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { apiCallApi, getQuotaNextCheck } from '@/services/api/apiCall';
import { apiClient } from '@/services/api/client';
import { useQuotaStore } from '@/stores/useQuotaStore';

const spies: Array<{ mockRestore(): void }> = [];
afterEach(() => {
  spies.splice(0).forEach((spy) => spy.mockRestore());
  useQuotaStore.getState().clearQuotaCache();
});

const payload = {
  authIndex: 'cooldown-fixture',
  method: 'GET',
  url: 'https://example.invalid/usage',
};

describe('v8 quota cooldown transport', () => {
  test('returns raw 429 responses to provider adapters while retaining the retry deadline', async () => {
    spies.push(spyOn(Date, 'now').mockReturnValue(1_000_000));
    const post = spyOn(apiClient, 'post').mockResolvedValue({
      status_code: 429,
      header: { 'Retry-After': ['90'] },
      body: '{"error":"rate limited"}',
    });
    spies.push(post);
    expect(await apiCallApi.request(payload)).toMatchObject({
      statusCode: 429,
      body: { error: 'rate limited' },
    });
    expect(post).toHaveBeenCalledWith('/requests/api-call', payload, undefined);
    expect(getQuotaNextCheck(payload.authIndex)).toBe(1_090_000);
  });

  test('a connection reset hides an old pending response deadline for the same auth index', async () => {
    let resolve!: (value: Record<string, unknown>) => void;
    spies.push(
      spyOn(apiClient, 'post').mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done as typeof resolve;
          })
      )
    );
    const pending = apiCallApi.request(payload);
    useQuotaStore.getState().clearQuotaCache();
    resolve({ status_code: 429, header: { 'Retry-After': ['90'] }, body: '' });
    await pending;
    expect(getQuotaNextCheck(payload.authIndex)).toBeUndefined();
  });

  test('profile enrichment does not clear the usage deadline; a fresh usage response does', async () => {
    const deadline = '2099-01-01T00:00:00Z';
    const post = spyOn(apiClient, 'post').mockResolvedValue({
      status_code: 200,
      header: { 'X-CPA-Quota-Next-Check': [deadline] },
      body: '{}',
    });
    spies.push(post);
    await apiCallApi.request(payload);
    post.mockResolvedValue({ status_code: 200, header: {}, body: '{}' });
    await apiCallApi.request({ ...payload, url: 'https://example.invalid/profile' });
    expect(getQuotaNextCheck(payload.authIndex)).toBe(Date.parse(deadline));
    await apiCallApi.request(payload);
    expect(getQuotaNextCheck(payload.authIndex)).toBeUndefined();
  });
});

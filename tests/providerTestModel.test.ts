import { afterEach, expect, test } from 'bun:test';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';

const originalGet = apiClient.get;
const originalPut = apiClient.put;
afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
});

test('a non-first test model survives provider save/read and can return to automatic', async () => {
  let records: unknown = [];
  apiClient.get = (async () => ({ 'openai-compatibility': records })) as typeof apiClient.get;
  apiClient.put = (async (_url: string, data: unknown) => {
    records = data;
  }) as typeof apiClient.put;
  await providersApi.createOpenAIProvider({
    name: 'official',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEntries: [],
    models: [{ name: 'gpt-4.1-mini' }, { name: 'gpt-6-luna' }],
    testModel: 'gpt-6-luna',
  });
  const [saved] = await providersApi.getOpenAIProviders();
  expect(saved.testModel).toBe('gpt-6-luna');
  expect(saved.models?.[0].name).toBe('gpt-4.1-mini');
  await providersApi.updateOpenAIProvider('official', 0, { ...saved, testModel: '' });
  const [automatic] = await providersApi.getOpenAIProviders();
  expect(automatic.testModel).toBeUndefined();
});

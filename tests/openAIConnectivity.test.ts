import { afterEach, expect, test } from 'bun:test';
import { apiCallApi, type ApiCallResult } from '../src/services/api/apiCall';
import { requestOpenAIConnectivity } from '../src/features/providers/sheets/forms/openAIConnectivity';

const original = apiCallApi.request;
afterEach(() => {
  apiCallApi.request = original;
});
const response = (statusCode: number, body: unknown): ApiCallResult => ({
  statusCode,
  body,
  bodyText: JSON.stringify(body),
  header: {},
});
const request = {
  url: 'https://api.example.com/v1/chat/completions',
  authIndex: 'test-index',
  header: { Authorization: 'Bearer $TOKEN$' },
};

test('uses the selected modern model and modern token limit on the first request', async () => {
  const calls: unknown[] = [];
  apiCallApi.request = async (payload, options) => {
    calls.push({ payload, options });
    return response(200, {});
  };
  await requestOpenAIConnectivity(request, 'gpt-6-luna', 30_000);
  expect(calls).toEqual([
    {
      payload: {
        ...request,
        method: 'POST',
        data: JSON.stringify({
          model: 'gpt-6-luna',
          messages: [{ role: 'user', content: 'Hi' }],
          stream: false,
          max_completion_tokens: 5,
        }),
      },
      options: { timeout: 30_000 },
    },
  ]);
});

test('retries once for explicit legacy parameter rejection without changing model or credentials', async () => {
  const calls: Record<string, unknown>[] = [];
  apiCallApi.request = async (payload) => {
    calls.push({ ...payload, data: JSON.parse(payload.data!) });
    return response(400, {
      error: {
        message: "Unsupported parameter: 'max_completion_tokens'",
        param: 'max_completion_tokens',
        code: 'unsupported_parameter',
      },
    });
  };
  const result = await requestOpenAIConnectivity(request, 'legacy-alias', 30_000);
  expect(result.statusCode).toBe(400);
  expect(calls).toHaveLength(2);
  expect(calls[0]).toMatchObject({
    ...request,
    data: { model: 'legacy-alias', max_completion_tokens: 5 },
  });
  expect(calls[1]).toMatchObject({ ...request, data: { model: 'legacy-alias', max_tokens: 5 } });
  expect(calls[1].data).not.toHaveProperty('max_completion_tokens');
});

for (const [status, error] of [
  [400, { message: 'max_completion_tokens must be positive', param: 'max_completion_tokens' }],
  [400, { message: 'Unsupported parameter: temperature', param: 'temperature' }],
  [401, { message: 'Unauthorized' }],
  [429, { message: 'Quota exceeded' }],
  [500, { message: 'max_completion_tokens is not supported' }],
] as const) {
  test(`does not retry unrelated failure ${status}: ${error.message}`, async () => {
    let count = 0;
    apiCallApi.request = async () => {
      count++;
      return response(status, error && { error });
    };
    expect((await requestOpenAIConnectivity(request, 'gpt-6-luna', 30_000)).statusCode).toBe(
      status
    );
    expect(count).toBe(1);
  });
}

test('network failures propagate without another request', async () => {
  let count = 0;
  apiCallApi.request = async () => {
    count++;
    throw new Error('network failure');
  };
  await expect(requestOpenAIConnectivity(request, 'gpt-6-luna', 30_000)).rejects.toThrow(
    'network failure'
  );
  expect(count).toBe(1);
});

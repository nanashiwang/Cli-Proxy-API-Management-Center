import { apiCallApi, type ApiCallRequest, type ApiCallResult } from '@/services/api/apiCall';
import { isRecord } from '@/utils/helpers';

type ProbeRequest = Pick<ApiCallRequest, 'authIndex' | 'url' | 'header' | 'proxy_url'>;

const rejectsCompletionLimit = (result: ApiCallResult): boolean => {
  if (result.statusCode !== 400) return false;
  const error = isRecord(result.body) && isRecord(result.body.error) ? result.body.error : null;
  const message = String(error?.message ?? result.bodyText).toLowerCase();
  const identifiesParameter =
    error?.param === 'max_completion_tokens' || message.includes('max_completion_tokens');
  return (
    identifiesParameter &&
    (error?.code === 'unsupported_parameter' ||
      /unsupported|not supported|unrecognized|unknown parameter/.test(message))
  );
};

export async function requestOpenAIConnectivity(
  request: ProbeRequest,
  model: string,
  timeout: number,
  useMaxCompletionTokens?: boolean
): Promise<ApiCallResult> {
  const send = (limit: 'max_completion_tokens' | 'max_tokens') =>
    apiCallApi.request(
      {
        ...request,
        method: 'POST',
        data: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          stream: false,
          [limit]: 5,
        }),
      },
      { timeout }
    );

  const firstLimit = useMaxCompletionTokens === false ? 'max_tokens' : 'max_completion_tokens';
  const result = await send(firstLimit);
  // Retry only an explicit parameter rejection, never auth, quota or network failures.
  return firstLimit === 'max_completion_tokens' && rejectsCompletionLimit(result)
    ? send('max_tokens')
    : result;
}

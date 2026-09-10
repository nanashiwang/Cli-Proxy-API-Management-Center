import type {
  AccountPoolCredential,
  AccountPoolKeyRule,
  AccountPoolsConfig,
} from '@/services/api/accountPools';

export const DEFAULT_GROUP = 'default';

export function membership(config: AccountPoolsConfig): Map<string, string> {
  return new Map(
    config.groups.flatMap((group) => group['credential-ids'].map((id) => [id, group.id] as const))
  );
}

export function moveCredentials(
  config: AccountPoolsConfig,
  ids: readonly string[],
  target: string
): AccountPoolsConfig {
  if (!config.groups.some((group) => group.id === target)) return config;
  const moved = new Set(ids);
  return {
    ...config,
    groups: config.groups.map((group) => {
      const kept = group['credential-ids'].filter((id) => !moved.has(id));
      return {
        ...group,
        'credential-ids':
          group.id === target && target !== DEFAULT_GROUP ? [...kept, ...moved] : kept,
      };
    }),
  };
}

export function ruleFor(config: AccountPoolsConfig, hash: string): AccountPoolKeyRule {
  return (
    config['key-rules'].find((rule) => rule['key-hash'] === hash) ?? {
      'key-hash': hash,
      scope: 'selected',
      'group-ids': [DEFAULT_GROUP],
    }
  );
}

export function setKeyRule(
  config: AccountPoolsConfig,
  rule: AccountPoolKeyRule
): AccountPoolsConfig {
  return {
    ...config,
    'key-rules': [
      ...config['key-rules'].filter((item) => item['key-hash'] !== rule['key-hash']),
      rule,
    ],
  };
}

export function effectiveCredentials(
  config: AccountPoolsConfig,
  rule: AccountPoolKeyRule,
  credentials: readonly AccountPoolCredential[]
): AccountPoolCredential[] {
  const groups = new Set(
    config.groups
      .filter(
        (group) =>
          !group.disabled &&
          (rule['lease-instance'] ? group.lease === true : !group.lease) &&
          (rule.scope === 'all' || rule['group-ids'].includes(group.id))
      )
      .map((group) => group.id)
  );
  const members = membership(config);
  return credentials.filter(
    (item) => !item.disabled && groups.has(members.get(item.id) ?? DEFAULT_GROUP)
  );
}

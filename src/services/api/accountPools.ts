import { apiClient } from './client';

export interface AccountPoolGroup {
  lease?: boolean;
  id: string;
  name: string;
  description?: string;
  disabled?: boolean;
  'credential-ids': string[];
}
export interface AccountPoolKeyRule {
  'lease-instance'?: string;
  'key-hash': string;
  name?: string;
  scope: 'selected' | 'all';
  'group-ids': string[];
}
export interface AccountPoolsConfig {
  enabled: boolean;
  groups: AccountPoolGroup[];
  'key-rules': AccountPoolKeyRule[];
}
export interface AccountPoolCredential {
  id: string;
  name: string;
  provider: string;
  disabled: boolean;
  unavailable: boolean;
  'group-id': string;
}
export interface AccountPoolKey extends AccountPoolKeyRule {
  preview: string;
  index: number;
}
export interface AccountPoolsResponse {
  leases?: {
    id: string;
    'group-id': string;
    owner: string;
    'expires-at': string;
    active: number;
  }[];
  'lease-error'?: string;
  config: AccountPoolsConfig;
  keys: AccountPoolKey[];
  credentials: AccountPoolCredential[];
  revision: string;
  'home-enabled': boolean;
}
export const accountPoolsApi = {
  get: () => apiClient.get<AccountPoolsResponse>('/account-pools'),
  save: (config: AccountPoolsConfig, revision: string) =>
    apiClient.put('/account-pools', { config, revision }),
};

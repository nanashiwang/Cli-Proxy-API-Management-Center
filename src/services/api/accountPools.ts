import { apiClient } from './client';

export interface AccountPoolGroup {
  id: string;
  name: string;
  description?: string;
  disabled?: boolean;
  'credential-ids': string[];
}
export interface AccountPoolKeyRule {
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

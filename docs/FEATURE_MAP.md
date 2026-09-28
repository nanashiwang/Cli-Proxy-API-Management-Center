# CLI Proxy API Management Center: capability map

Verified from the local checkout on 2026-09-29. This is a scoped navigation aid, not a complete product audit or a replacement for [existing guidance](../AGENTS.md). Recheck implementation when using it; extend entries only as tasks confirm the relevant behavior. Do not treat roadmap ideas as implemented features.

| Capability | Entry / UI | API / orchestration | Implementation / data | Review boundary |
|---|---|---|---|---|
| Navigation and API transport | [src/router/MainRoutes.tsx](../src/router/MainRoutes.tsx) | [src/services/api/client.ts](../src/services/api/client.ts) | [src/stores](../src/stores) | The UI is not the proxy. Backend /v0/management contracts are the source of truth. |
| Usage and per-key statistics | [src/services/api/usage.ts](../src/services/api/usage.ts) | [src/services/api/apiKeyUsage.ts](../src/services/api/apiKeyUsage.ts) | [src/components](../src/components) | Find the existing overview and detail components before adding another statistic; preserve request/attempt definitions. |
| Auth files, OAuth and account pools | [src/pages/OAuthPage.tsx](../src/pages/OAuthPage.tsx) | [src/services/api/authFiles.ts](../src/services/api/authFiles.ts) | [src/services/api/accountPools.ts](../src/services/api/accountPools.ts) | Cross-check ../CLIProxyAPI handlers before changing OAuth or auth-file semantics. |
| Configuration and logs | [src/pages/LogsPage.tsx](../src/pages/LogsPage.tsx) | [src/services/api/config.ts](../src/services/api/config.ts) | [src/services/api/logs.ts](../src/services/api/logs.ts) | Preserve management authentication, stored configuration compatibility and error handling. |

Use personal/main for pushes and Bun for existing application checks. New user-facing strings still require all supported locales. Backend and frontend release versions remain separate.

Before adding a feature, inspect adjacent flows and the current source of truth; shared filters, data definitions and access rules must not diverge across entry points.

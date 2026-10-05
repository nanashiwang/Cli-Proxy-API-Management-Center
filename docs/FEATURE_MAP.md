# CLI Proxy API Management Center: capability map

Initially verified on 2026-09-29; usage timezone, pricing and quota facts rechecked on 2026-10-05. This is a scoped navigation aid, not a complete product audit or a replacement for [existing guidance](../AGENTS.md). Recheck implementation when using it; extend entries only as tasks confirm the relevant behavior. Do not treat roadmap ideas as implemented features.

| Capability | Entry / UI | API / orchestration | Implementation / data | Review boundary |
|---|---|---|---|---|
| Navigation and API transport | [src/router/MainRoutes.tsx](../src/router/MainRoutes.tsx) | [src/services/api/client.ts](../src/services/api/client.ts) | [src/stores](../src/stores) | The UI is not the proxy. Backend /v0/management contracts are the source of truth. |
| Usage and per-key statistics | [src/services/api/usage.ts](../src/services/api/usage.ts) | [src/services/api/apiKeyUsage.ts](../src/services/api/apiKeyUsage.ts) | [src/features/usage](../src/features/usage) | Browser timezone matches date filters and record display; old backend charts declare UTC. Fast badges use effective billing facts; modal detail survives exit animation. Preserve request/attempt definitions. |
| Auth files, OAuth and account pools | [src/pages/OAuthPage.tsx](../src/pages/OAuthPage.tsx) | [src/services/api/authFiles.ts](../src/services/api/authFiles.ts) | [src/services/api/accountPools.ts](../src/services/api/accountPools.ts) | Cross-check ../CLIProxyAPI handlers before changing OAuth or auth-file semantics. |
| Codex quota and balance | [src/features/quota/providers/codex/CodexQuotaBody.tsx](../src/features/quota/providers/codex/CodexQuotaBody.tsx) | [src/features/quota/providers/codex/data.ts](../src/features/quota/providers/codex/data.ts) | [src/features/quota/providers/codex/credits.ts](../src/features/quota/providers/codex/credits.ts) | Reuse official usage response; retain decimal balance precision, distinguish missing/zero/unlimited, and keep reset cards independent. |
| Configuration and logs | [src/pages/LogsPage.tsx](../src/pages/LogsPage.tsx) | [src/services/api/config.ts](../src/services/api/config.ts) | [src/services/api/logs.ts](../src/services/api/logs.ts) | Preserve management authentication, stored configuration compatibility and error handling. |

Use personal/main for pushes and Bun for existing application checks. New user-facing strings still require all supported locales. Backend and frontend release versions remain separate.

Before adding a feature, inspect adjacent flows and the current source of truth; shared filters, data definitions and access rules must not diverge across entry points.

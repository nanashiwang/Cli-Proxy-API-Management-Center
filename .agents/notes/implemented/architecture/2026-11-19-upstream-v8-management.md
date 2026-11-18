# Agent Note: Upstream v8 management integration

Status: implemented

## Problem

The personal management application diverges from upstream across provider identity, quota guard, account pools and billing. Upstream now uses v8 grouped providers and adds routing, OAuth, plugin, quota and payload functionality. A wholesale replacement would lose personal capabilities.

## Decision

The application merges the complete upstream history while retaining personal account pools, usage and service health, persisted provider/key identities and test preferences, OpenCode and quota guard. Use upstream v8 client transport and extend the backend's versioned management routes for personal APIs. Keep compatible legacy routes server-side. Carry new upstream UI entry points together with existing personal navigation. Choose the latest merged stable upstream tag as the frontend release base, then increment its CPA suffix.

## Alternatives considered

Selective backports avoid the v8 migration but do not meet the requested full feature integration. Replacing the personal application with upstream removes existing behavior. Keeping all old conflict sides leaves upstream contracts inconsistent. Integrating each conflict and validating both test families preserves intended behavior at a higher review cost.

## Consequences

Provider grouping and credential identity remain stable on save. Quota cache keys include runtime/plugin identity; personal cooldown deadlines use a numeric connection generation and never leak across connections. Upstream provider adapters receive raw 429 responses while the transport retains Retry-After deadlines. Profile enrichment does not erase a quota deadline. The guard controls share the advanced configuration section, and credential bulk refresh reuses upstream's detailed results.

The frontend requires a matching personal v8 backend. Frontend and backend releases remain separate; both must finish compatibility checks before publication. The latest merged stable tag determines the frontend base, preventing future CPA releases from remaining on an obsolete upstream version. The subsequent personal/main model-controls change is merged with its own history and adapted to v8 connection isolation.

## Verification

Bun 1.4.3 passes 2,570 tests, ESLint (one pre-existing AccountPoolsPage hook warning), TypeScript and production build. Regression coverage includes provider identity and test-model persistence, grouped provider editing, quota guard YAML round-trip, exact balance values, cooldown response/connection isolation, and personal usage metrics. Browser checks use synthetic v8 API responses to exercise navigation, quota empty state, account groups and the log-loss alert. This does not replace live backend contract validation or published artifact verification.

## Related-note audit

Existing provider identity, test-model, quota guard, quota snapshots, timezone and service-health notes remain authoritative. This note owns only integration and release-baseline selection and does not supersede those invariants.

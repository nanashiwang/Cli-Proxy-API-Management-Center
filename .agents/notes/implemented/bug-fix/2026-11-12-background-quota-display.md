# Agent Note: Display background quota observations

Status: implemented

## Problem

The auth-files response already includes normalized backend quota snapshots, but both quota card hosts read only manually fetched browser state. The quota page never synchronizes its file list after mount, hiding available observations and leaving users to trigger another upstream query.

## Decision

Read existing codex_quota/provider_quota windows at the display boundary, without new backend endpoints or writes into the manual-response cache. Both hosts show backend percentages, original per-window observation/reset times and guard health. Preserve manual provider details in an explicitly labeled disclosure. Both hosts retain a manual refresh control when an automatic snapshot is present, respecting the same cooldown. Failed/stale observations remain visible as last-known values; no timestamp expiry fabricates replenishment. Reuse normalized observations in timeline/sort and loaded counts. Visible connected pages poll the existing local auth-files endpoint every 15 seconds, with overlap and stale-session fences. This never calls provider quota endpoints.

## Alternatives considered

Automatically clicking every card reuses provider parsers but still generates upstream traffic and fails during cooldown. Converting percentages into provider-specific counts invents limits, balances and subscription metadata. A new backend endpoint duplicates a snapshot already returned by the authenticated file list. Keeping only a separate summary panel leaves the main cards and timeline inconsistent.

## Verification

Opening either host displays all supported provider observations without api-call requests. Background changes appear after the local list refresh. Failed checks preserve labeled prior values and next-check deadlines. Missing/invalid snapshots retain the manual flow. Timeline and sorting consume the displayed reset instants. Session changes and overlapping list reads cannot restore old snapshots. 603 frontend tests, lint/type-check/build, snapshot normalization/timeline tests and browser checks pass. Browser fixtures verify all five providers, both hosts, automatic 15-second synchronization, retained failure values, original observation times, mobile width and zero provider api-call requests. Note validation runs before commit.

## Consequences

The backend snapshot contains percentage windows, not every provider billing/profile detail. Such details remain explicitly manual. The list polling interval adds lightweight management traffic. Observation time must never be replaced with browser refresh time.

## Related notes

The [quota guard note](../../implemented/feature/2026-11-11-codex-quota-guard.md) owns routing and cooldown; this note owns display only. Existing timeline calendar and usage/accounting notes retain their separate contracts.

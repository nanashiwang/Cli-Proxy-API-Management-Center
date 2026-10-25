# Agent Note: Preserve local calendar boundaries in quota timelines

Status: implemented

Date: 2026-11-08
Owner: codex
Class: bug-fix

## Problem

The quota timeline currently divides a multi-day span into equal-duration cells.
During daylight-saving transitions, a local calendar day is not always 24 elapsed
hours, so the chart can place midnight boundaries and quota-window fills at the
wrong horizontal positions and can render duplicate or missing date labels.

## Existing capabilities and impact

The affected entry is the quota timeline rendered from
`src/features/quota/components/QuotaTimeline.tsx`, with pure span/window math in
`src/features/quota/quotaTimelineModel.ts`. The backend quota payload and provider
contracts remain unchanged. The upstream patch adds local calendar cell generation,
weighted CSS grid tracks, and subprocess-based DST tests without changing the
quota API or adding user-facing strings.

## Decision

Cherry-pick upstream commit `e2d335b` as a focused frontend batch. Preserve the
current quota data model and use local calendar boundaries for weekly/session
cells, weighting CSS grid tracks by actual elapsed hours. Keep CPA's current limit
label semantics when resolving the local conflict. Do not combine this with
unrelated quota features or localization changes.

## Alternatives considered

- Keep equal-duration cells: rejected because the visual position of local
  midnight and reset boundaries remains wrong on DST transition days.
- Rebuild the quota timeline around UTC: rejected because the UI labels and user
  navigation are local-calendar concepts.
- Add a new timezone abstraction: rejected because local `Date` calendar
  boundaries are sufficient and the backend contract does not expose a separate
  display timezone for this chart.

## Verification

- Weekly and session cells use local calendar boundaries and elapsed durations.
- DST spring-forward, fall-back, and non-hour transition cases preserve date
  labels, span coverage, and reset-window alignment.
- Focused timeline tests pass. Full `bun run verify`, note validation, and the
  frontend release workflow are the remaining batch gates.

## Consequences

- **Benefit**: Local midnight columns and reset-window fills stay aligned across
  DST and non-hour timezone transitions.
- **Cost and limit**: The chart has variable-width cells on transition days. The
  backend quota contract and provider data remain unchanged; other upstream quota
  changes remain separately reviewable.

## Related-note audit

No active note owns this timeline decision. The capability-review process note
remains the governing documentation workflow.

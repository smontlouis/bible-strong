# ADR-0016: Use synchronous migration startup fast paths

## Status

Accepted.

## Context

The application migration orchestrator originally persisted only applicable plans. A clean
inspection therefore left no durable evidence and repeated filesystem, SQLite and Firestore work
on every launch. Local and account migration surfaces also displayed checking messages before a
migration had been detected, contradicting the clean-startup requirement in issue 274.

Account inspection cannot become fully synchronous because current remote data may contain legacy
content written by an older client. Letting incoming listeners hydrate that content before
inspection would weaken the account-sync boundary. Blocking access to locally persisted data while
the network is slow is unnecessary, but local mutations made during that interval must not be
dropped.

## Decision

Persist versioned clean-inspection checkpoints alongside migration executions. The MMKV state
adapter exposes a synchronous read, and the orchestrator exposes a startup disposition: ready,
inspect or resume. A one-time migration that is already terminal or has a matching clean checkpoint
uses the ready fast path. Registering a newer migration version invalidates that result naturally.

Local startup checks the MMKV disposition before legacy preparation or Redux persistence. The ready
path skips asynchronous preparation; unknown or resumable state keeps historical preparation before
persistence so old AsyncStorage data cannot be missed. A first unknown inspection uses generic
loading copy; migration language appears only after an applicable plan is detected. Interrupted
executions still resume behind the mandatory gate.

Account inspection keeps incoming hydration disabled but leaves the locally persisted application
usable. Outgoing mutations use the existing outgoing-only journal until inspection succeeds, so a
subsequently detected migration can reconcile them. An applicable account plan requires explicit
confirmation before execution. Continuing after a failure asks the orchestrator to persist an
explicit terminal abandonment before incoming synchronization resumes.

Legacy Bible references are canonicalized at the Firestore ingress seam. Initial and later listener
snapshots are transformed before Redux hydration, and only changed documents are written back. The
registered reference migration remains available only to resume plans persisted by an older build;
new discovery reuses listener snapshots instead of scanning every subcollection before listeners
start. This still handles data reintroduced by an older client. Embedded account data remains a
recurring inspection because it requires the resumable cross-collection migration.

## Consequences

Warm clean launches perform no local migration discovery and show no migration surface. Account
network work no longer blocks access to local data, and recurring reference safety reuses normal
listener reads. Incoming data, UID isolation, interrupted execution recovery and journaled mutation
precedence remain gated as before.

Clean checkpoints contain only technical migration identity, phase, scope and timestamp. They do
not contain user content. Inspection duration and fast-path events are recorded without account
identifiers or Bible references.

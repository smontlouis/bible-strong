# ADR-0036: Centralize the Mobile Offline Resource Inventory

- Status: Accepted
- Date: 2026-08-31

## Context

The mobile application previously discovered installed Resources independently in each feature.
Screens and access adapters queried SQLite metadata, checked files, or incremented unrelated Jotai
counter atoms to force another check after an installation. Opening a selector could therefore scan
many Bible, commentary, Strong, interlinear, dictionary, and database artifacts before presenting
its first frame. The same physical Resource could be verified repeatedly by several mounted
screens.

The exhaustive Resource catalog already describes what can be acquired, while the installation
journal and MMKV publication records describe completed local installations. Neither is the
runtime source of truth for the current device: catalog presence does not mean installed, and a
persisted installation record still needs one physical reconciliation after an interrupted process
or an application upgrade.

## Decision

The mobile application owns one process-wide `OfflineResourceRegistry` for device installation
state.

The registry:

- synchronously projects the persisted publication records over the current Resource catalog;
- performs one deduplicated physical reconciliation after migrations and installation-journal
  recovery during full application startup;
- exposes one immutable, subscribable snapshot containing availability, integrity, installed
  revision, catalog revision, and update availability for every known Resource identity;
- updates synchronously when a managed installation or deletion completes;
- invalidates or marks a Resource corrupt when a reader detects a local integrity failure;
- deduplicates any necessary lazy reconciliation for an unverified Resource.

Resource selectors, download management, storage estimates, and availability boundaries subscribe
to this registry instead of scanning files or incrementing refresh-counter atoms. Local Strong
Bible, interlinear, and Strong lexicon adapters also obtain their availability through the registry,
while retaining their specialized metadata after reconciliation.

TanStack Query remains responsible for Resource content and remote requests. The registry does not
cache chapters, verses, commentary bodies, lexicon entries, or API responses. Redux and Firestore
remain reserved for user data and preferences; device installation state is neither user data nor a
cloud-synchronized preference.

## Consequences

Opening Resource interfaces is synchronous with respect to installation state, and mounted screens
observe installs and removals without bespoke refresh counters. Physical verification cost is paid
once at startup or once after an explicit invalidation, rather than once per consumer. Publication
updates are derived consistently by comparing the installed and catalog archive revisions.

The registry is process-local and rebuilt from durable publication metadata at every launch. File
changes made outside managed application workflows are detected by startup reconciliation, not by
continuous polling. A completed installation is exposed immediately but remains unverified until
the specialized reader performs its first reconciliation; this preserves responsive UI updates
without treating generic installation metadata as validated Strong or interlinear schema metadata.

All new Resource families must provide a canonical Offline-copy identity, catalog entry, physical
probe, and managed install/delete event. Feature screens must not introduce new installation
counter atoms or direct filesystem scans for availability.

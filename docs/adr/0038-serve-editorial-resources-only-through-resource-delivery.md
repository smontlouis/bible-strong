# ADR-0038: Serve editorial resources only through Resource Delivery

## Status

Accepted

## Context

The Firebase Application API still exported four first-generation HTTP functions for Bible verse
counts, dictionary entries, and Greek or Hebrew Strong entries. Those functions read mutable
Firestore collections directly. The same editorial content is now published as immutable Resource
revisions and delivered through the Resource service for Online access or through validated Offline
copies. No application caller depends on the Firebase endpoints anymore.

Keeping both paths makes ownership ambiguous and allows old, unversioned content to disagree with
the active Resource catalog.

## Decision

Bible text, dictionary, and Strong lexicon reads are owned exclusively by Resource Delivery. Remove
the `count_verses`, `dictionnaire`, `grec`, and `hebreu` Firebase exports and their implementations.
The Application API remains responsible only for application-specific and account-owned operations
that cannot safely or reliably run on the client.

A deployment-surface test prevents the retired Resource functions from being reintroduced into the
Firebase entrypoint.

## Consequences

Every editorial read observes the active Resource revision, rights, availability, and integrity
contracts. There is no fallback to the retired Firestore collections; failures must remain explicit
Resource availability failures. Deploying the Application API removes the four legacy functions
from the Firebase deployment surface.

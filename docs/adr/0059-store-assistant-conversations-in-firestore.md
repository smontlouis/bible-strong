# ADR-0059: Store assistant conversations in Firestore

## Status

Accepted

## Context

The web study assistant originally kept account-scoped conversations in browser local storage.
That made history specific to one browser and made clearing browser data destructive. The feature
has not reached production, so no local conversation migration or compatibility path is required.

Bible Strong already uses Firebase Authentication and Firestore for private user-owned data. The
separately deployed assistant service owns model orchestration, not application data ownership.

## Decision

Firestore is the canonical store for authenticated assistant conversations. Store conversation
metadata under `users/{uid}/assistantConversations/{conversationId}` and complete question/answer
turns under its `turns` subcollection. A turn is written only after its assistant response reaches
a terminal state. Streaming deltas remain in UI memory and never cause one database write per
token.

The Expo feature accesses persistence through a conversation repository. It subscribes to the
bounded conversation index and only subscribes to the turns of the selected conversation. The
existing full transcript, bounded inference history and memory checkpoint remain application-owned;
the assistant service does not read Firestore directly.

Conversation content has no local-storage fallback or import path. Device-local storage may retain
UI-only preferences such as whether the assistant follows the reading context.

Firestore rules restrict `users/{uid}` and all descendants to that authenticated UID. Conversation
and turn writes additionally validate their version, roles, terminal states, field sets and bounded
sizes. The previous authenticated global-read rule is removed.

## Consequences

History follows the account across browsers, and account deletion already removes it through the
recursive `users/{uid}` cleanup. Conversation deletion removes its bounded turn set and parent in a
single batch. Firestore failures are visible and do not silently fall back to a divergent local
history.

The application performs one turn write and one metadata write per completed, interrupted or
failed request. A browser closed during an active stream may lose that unfinished turn. Supporting
durable partial streaming would require an explicit checkpoint policy rather than token-level
writes.

This decision supersedes the local-persistence parts of ADR-0048, ADR-0049, ADR-0050 and ADR-0051;
their assistant-service separation and conversation-memory decisions remain in force.

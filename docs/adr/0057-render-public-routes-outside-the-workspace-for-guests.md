# ADR-0057: Render public routes outside the workspace for guests

- Status: Accepted
- Date: 2026-09-20

## Context

Canonical public resource URLs reuse Expo screens that are also opened inside the desktop
workspace. Rendering every direct URL as a workspace panel exposes the visitor to a personal
sidebar, an unrelated active tab, and a narrow content panel. Choosing the shell from navigation
history would make a reload unpredictably change the experience for an authenticated user.

## Decision

On Web, choose the shell from Firebase authentication state:

- an authenticated user keeps the complete workspace on every route and after reload;
- an unauthenticated visitor opening a canonical public resource route gets a standalone public
  shell;
- authentication resolution blocks shell selection briefly so the public shell never flashes for
  a restored authenticated session;
- “Open Bible Strong” lets a guest explicitly enter the workspace for the current browser session
  without changing the canonical URL.

The public shell reuses the same route component and Resource access layer. It adds only a compact
Bible Strong header and disables the workspace panel frame and account-specific chrome. Legacy and
non-public application routes continue to use the workspace.

## Consequences

Shared URLs remain clean and deterministic. Connected users retain their familiar workspace, while
anonymous visitors and crawlers see content without personal application chrome. Guest workspace
entry is intentionally session-local and returns to the public shell after reload. SSR, static
rendering, metadata, and public Resource API policy remain separate decisions.

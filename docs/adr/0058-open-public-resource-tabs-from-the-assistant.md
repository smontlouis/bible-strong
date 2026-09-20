# ADR-0058: Open only public resource tabs from the assistant

- Status: Accepted
- Date: 2026-09-20

An explicit navigation request may open a new public resource tab. The app advertises
`open_public_tab` alongside the existing passage-only `open_tab` capability. The API
selects the extended tool schema only for capable clients; older clients retain the
Bible/comparison schema, and execution independently rejects unsupported destinations.

Destinations are Bible, comparison, Bible-text search, Strong, dictionary, Nave,
passage commentaries, a specific commentary resource, timeline and public editorial
plans/meditations. Resource lists can be opened where the existing tab supports them.
Exact entry, section, event and reading identifiers come from public retrieval tools.
This action does not open arbitrary URLs or accept arbitrary tab-state objects.

A strict discriminated contract validates each target and rejects extra fields.
The app validates again before constructing a fresh tab through its existing
navigation path. Notes, studies, bookmarks, highlights, tags, links and account
settings are excluded. Search opens with explicit passage-only filters, independent
of the user's saved filters. Plan targets resolve through the public plans collection
and existing `enroll:false` content loading; no enrollment, reading completion,
reminder, personal-progress identifier or write operation is accepted.

The contract is mirrored into the private API repository. Regression tests exercise
stream parsing through tab construction, provider tool calls through action emission,
legacy capability gating, malformed targets and attempted personal destinations.

API rollout: version `3ef02ca8-fe28-4a55-bc6a-9f55674b87be` was deployed from a
validated bundle snapshot. All deployed bindings were compared before/after and
remained identical, including activation and account/debug access lists. App targeted
coverage passes (45 tests); API coverage passes (95 tests, one optional test skipped).
Root typecheck and Expo Web export pass. The full Expo suite retains unrelated failures
in source/Strong navigation assertions and the palette's Jest dependency setup.
The web client changes are local; a hosted frontend release remains separate.
Changed-file ESLint passes; the full repository lint was stopped after seven minutes.
A synthetic live-provider smoke did not reach generation because the local Jev call
returned `JEV_UNAVAILABLE`; no real model-driven UI opening is claimed by these tests.

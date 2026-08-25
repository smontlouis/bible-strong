---
name: resource-publication
description: Publish Bible Strong resource bundles, catalogs, Neon revisions, or R2 artifacts. Use for production or staging resource release workflows in this repository.
---

# Resource Publication

Use a differential release by default. The exhaustive mobile catalog remains the source of truth,
but ordinary releases must validate, upload, import, and smoke-test only the identities whose bundle
or catalog entry changed.

## Workflow

1. Build the changed bundles and their required dependants together.
2. Update `src/assets/mobile-resource-catalog.json` while preserving every unchanged entry exactly.
3. Validate the exhaustive catalog locally and the selected bundles against their corresponding
   catalog entries.
4. Publish only selected bundles with `yarn resources:r2:publish-changed:prod --root <bundle>...`.
   For `core`, `entities`, and `resources`, use
   `yarn resources:r2:publish-strong-lexicon:prod`.
5. Import only the changed bundle roots into hosted Neon, in dependency order.
6. Deploy the Worker so its checked-in catalog becomes public, then verify health, catalog parity,
   protected artifact behavior, and at least one changed database read.

The integrated Bible workflow already derives `changedBundlePaths` and uses this differential R2
path. Use `resources:r2:publish-catalog:prod` only when the user explicitly requests a complete R2
bootstrap or storage audit. A full catalog change does not authorize rewriting unrelated catalog
entries or rebuilding unrelated resources.

Production mutation still requires the user's authorization and the repository's normal credential,
clean-worktree, revision, dependency, and rollback gates.

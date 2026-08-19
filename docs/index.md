# Documentation Index

This directory is the repo-level reference set for agents and humans working on Bible Strong.

## Start Here

| Document | Purpose |
|---|---|
| `../CONTEXT.md` | Product/domain context, glossary, and invariants. |
| `architecture.md` | System architecture and cross-cutting flows. |
| `app-flows.md` | Detailed product flows, screens, states, and route inventory. |
| `assets/app-flows/dist/index.html` | Built React Flow app flow map with pan, zoom, drag, curated-flow filters, inventory filters, thumbnails, and detail panel. |
| `assets/app-flows/data/curated-flows.json` | Manual source of product surfaces, user flows, and explicit transitions between captures. |
| `assets/app-flows/data/app-flows.json` | Structured app-flow graph generated from the screenshot manifest and curated flows. |
| `assets/app-flows/data/screenshots.json` | Versioned screenshot manifest for visual and agent-consumable flow mapping. |
| `assets/app-flows/capture-notes.md` | Argent capture notes, limitations, state mutations, and remaining capture targets. |
| `source-tree.md` | Annotated map of important folders and files. |
| `dev-guide.md` | Setup, scripts, simulator workflow, and validation. |
| `data-models.md` | Persisted state, local databases, Firestore sync, and identifiers. |
| `relations-architecture.md` | Target architecture for a unified relation graph, query strategy, and denormalized indexes. |
| `conventions.md` | Coding conventions and project-specific rules. |
| `bible-viewer-native-migration-audit.md` | Synthesis for migrating the Bible reader from DOM/WebView to native SwiftUI/Compose components. |
| `bible-viewer-swiftui-audit.md` | iOS-specific audit for a SwiftUI/native Bible reader. |
| `bible-viewer-compose-audit.md` | Android-specific audit for a Jetpack Compose/native Bible reader. |
| `bible-lausanne-source.md` | Lausanne Bible source provenance, generation, versification mapping, and validation. |
| `agents/research/clementine-vulgate-source.md` | Clementine Vulgate source provenance, public-domain review, canon, and import recommendations. |

## Resource Architecture

| Document | Purpose |
|---|---|
| `online-resources-design.md` | Target online-first architecture. Its status section distinguishes design work from implemented local behavior. |
| `online-resources-offline-audit.md` | Historical June 2026 audit, retained for context and explicitly marked as a snapshot. |
| `adr/0013-pair-canonical-bible-text-with-optional-strong-sidecars.md` | Canonical Bible text and optional version-specific Strong indexes. |
| `adr/0014-pair-original-language-text-with-localized-interlinear-indexes.md` | BHG canonical text and localized interlinear indexes. |
| `adr/0015-use-storage-generation-for-offline-copy-updates.md` | Superseded Cloud Storage generation strategy. |
| `adr/0025-use-catalog-sha-for-r2-offline-copy-updates.md` | R2 artifact delivery and catalog SHA-256 update detection. |
| `adr/0017-own-strong-routes-under-strong.md` | Ownership and navigation of standalone Strong pages. |
| `adr/0021-package-all-offline-resources-as-zip.md` | ZIP packaging, mobile catalog, validation, and installation strategy. |
| `agents/research/legacy-bible-strong-upgrade-workflow.md` | Historical migration analysis for legacy Strong Bible installations. |
| `agents/research/strong-bible-local-storage.md` | Local storage design research for canonical Bibles and Strong sidecars. |
| `agents/research/step-interlinear-runtime-artifacts.md` | Runtime artifact research for STEP/BHG interlinear data. |

## Agent-Specific Docs

| Document | Purpose |
|---|---|
| `agents/harness-readiness.md` | Current readiness level and gaps. |
| `agents/harness-report/index.html` | Self-contained human report hub with dashboard and links to full readiness, validation, quality, risk, observability, commands, Level 2, and decisions pages. |
| `agents/validation.md` | Canonical checks before finishing work. |
| `agents/smoke-tests.md` | Manual/mobile smoke paths and evidence expectations. |
| `agents/sensitive-areas.md` | Areas requiring extra care or explicit approval. |
| `agents/observability.md` | Error reporting and debugging signals. |
| `agents/issue-tracker.md` | Issue tracker configuration. |
| `agents/triage-labels.md` | Canonical triage labels. |
| `agents/domain.md` | How agents should consume domain docs. |

## Decision Records

ADRs live in `adr/`. Do not invent ADRs retroactively; add one when a new durable engineering decision is made or when an existing implicit decision is confirmed.

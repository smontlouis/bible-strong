# Resource access modules isolate local and future remote adapters

## Status

Accepted

## Context

Bible Strong currently reads Bible and study resources mostly through local SQLite/JSON helpers.
That implementation supports offline use well, but it makes online-first resource loading hard:
screens and feature helpers can end up knowing whether a resource is installed, which file should
exist, which SQLite table to query, and which error means "download required".

The online-first resources PRD requires each resource to support local data and future remote data
without spreading source-selection logic through the app.

## Decision

Create resource access modules under the resources feature. A resource access module exposes a
domain interface for a resource capability, and its implementation owns source selection, local
storage details, cache behavior, structured errors, and future remote adapters.

Legacy helpers may remain as compatibility adapters while callers migrate. New resource-source
behavior belongs behind the resource access module, not in screen code.

## Consequences

Callers get a smaller interface for resource reads and availability checks. Tests can exercise
resource behavior at the same seam that callers use.

The first modules are intentionally local-only adapters, but their seams are chosen where a future
remote adapter will be real: resource availability and Bible content access. Additional resource
domains should migrate behind similar modules before adding remote behavior.

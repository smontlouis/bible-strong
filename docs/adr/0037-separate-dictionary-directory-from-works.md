# ADR-0037: Separate the Dictionary Directory from Dictionary Works

- Status: Accepted
- Date: 2026-08-31

## Context

Bible Strong publishes independently authored French and English dictionaries that can be read
online or installed separately. A single alphabetical experience is desirable, but physically
merging definitions would erase Resource identity and make independent downloads, attribution, and
updates difficult. Per-work word indexes also cannot reliably drive passage discovery because a
surface word depends on the displayed Bible version.

## Decision

Dictionary works remain independent Resources containing their own definitions. A generated
Dictionary directory contains only work and entry identities, normalized headings, correspondence
clusters, and evidenced Dictionary passage anchors. A directory result may group corresponding
entries for discovery, but opening it always resolves to an exact work and entry. Passage anchors
identify exact entries and record their evidence; they do not assert that an entry heading occurs
in every Bible translation.

## Consequences

The application can expose one multilingual alphabet and search surface while preserving separate
downloads and editorial attribution. The directory must be regenerated when participating work
revisions or correspondence rules change. Dictionary content remains readable without the
directory, while global discovery degrades to per-work browsing if the directory is unavailable.

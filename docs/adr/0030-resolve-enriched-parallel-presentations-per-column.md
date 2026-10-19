# ADR-0030: Resolve enriched parallel presentations per column

## Status

Accepted. This decision supersedes the parallel-display clause in ADR-0014 that limited advanced
BHG presentation to the primary Bible column. It also narrows the personal-data clauses of ADR-0013
and ADR-0014 from the whole viewer to the columns that show an interlinear presentation.

## Context

Parallel Bible reading can combine versions with different resource capabilities. Applying one
active Strong or interlinear presentation request to every column makes a Bible that has no such
capability appear broken, even though its ordinary Bible text is available. Conversely, silently
falling back when a capable Bible's required sidecar fails would hide a real resource problem.

BHG is a special case. Its localized interlinear index provides both the original-text Strong
presentation and the detailed interlinear presentation. When BHG participates in a comparison, its
column should follow the active study intent even when BHG is not the primary Bible.

## Decision

Resolve the requested enriched presentation independently for every parallel Bible column.

A version without the requested Strong or interlinear capability receives a plain-text chapter
request. Capability absence is not a loading error. A version that declares the requested
capability continues to request its enrichment; failure to load that required resource remains a
user-visible resource error rather than falling back silently.

For a BHG parallel column:

- active Strong presentation selects BHG's original-text Strong mode;
- active detailed interlinear presentation selects BHG's detailed interlinear mode;
- active reverse-interlinear presentation also selects BHG's detailed interlinear mode because BHG
  is the original-language source of the reverse alignment.

Personal Bible data follows the same per-column resolution. A column that shows a reverse-interlinear
presentation, or BHG in one of its advanced presentations, holds no personal Bible data: it paints
no selection, highlight or word annotation, its verses cannot be selected, and the native bridge
ignores personal-data actions that name its version. The other columns keep the standard
personal-data behavior, and verse-level markers (bookmarks, notes, tags, relations) stay on the row.
The whole viewer leaves personal data out only when every column shows an interlinear presentation.
A version shown twice keeps its personal data while one of its columns shows its text. Turning a
column to an interlinear presentation ends a verse selection or an annotation session held in it.

The resolved presentation travels with the parallel column data through the native-to-DOM boundary.
Rendering uses the primary Bible's mode for its own column and each additional column's resolved
mode for that column. The parallel query key includes the interlinear mode so changing presentation
cannot reuse stale plain or enriched results.

## Consequences

Comparisons such as LSG, DBY and BDS remain readable in Strong or reverse-interlinear mode: capable
columns show their enrichment and BDS shows its normal text. A missing Strong or interlinear
resource for LSG, DBY or BHG still produces the appropriate error.

BHG can now render an advanced presentation in an additional parallel column, replacing the former
primary-column-only behavior. Reading DBY in reverse interlinear beside LSG still lets the reader
select, highlight and annotate LSG. Each parallel result must retain its resolved presentation metadata
until rendering, and tests must cover both horizontal and vertical consumers through their shared
row model.

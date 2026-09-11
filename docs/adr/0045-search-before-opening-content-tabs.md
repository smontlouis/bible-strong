# ADR-0045: Search before opening content tabs

- Status: Accepted
- Date: 2026-09-11
- Partially supersedes ADR-0043 for new-tab category actions.

The New tab presentation remains intact. Selecting a content category opens a
scoped search: the command palette on Web, a search sheet on native. Selecting a
result creates a new content tab; cancelling creates nothing. Existing list tabs
and library navigation remain supported.

Passage and Comparison are separate command-palette modes using the same
reference parser. Each mode opens only its own tab type. Full Search instead
provides two icon actions on passage results: open a Bible tab or compare.

Commentary search matches catalog titles, short names and authors, not commentary
paragraphs. Plan search matches saved and published plan titles; a published plan
is loaded using the existing plan flow before its tab is opened. Timeline search
matches period and event titles in both catalog languages. There is no independent
person index; names are discoverable where present in these titles. Empty timeline
search lists periods. Search data and opening intent are shared between platforms.

Full Search integrates these sources into its existing source filters and result
sections. It does not have a separate discovery toolbar or separate search form.
Persisted experimental discovery scopes migrate to the equivalent source filter.

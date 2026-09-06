# Responsive study workspace layout

Expo uses one reading column for page headers, filters and content. Its maximum
width is **830 logical pixels**, including each screen's horizontal padding.
On narrower containers, the column takes the available width. This applies to
native tablets as well as the browser; it is not a platform-specific breakpoint.

Use `PageContent` from `~common/ui/PageContent` inside a full-width surface.
Keep backgrounds, header dividers and Strong section bands on the outer surface.
Put titles, actions and reading content inside the column. Do not constrain the
root navigator, the sidebar or an entire page just to constrain its header.

For native `ScrollView`, `FlatList`, `SectionList` and `LegendList`, compose
`pageContentStyle` into `contentContainerStyle`, preserving padding and list
virtualization. The shared UI scroll/list components already apply this style.
Horizontal lists and the pannable chronology canvas keep their horizontal extent;
their headers and textual detail screens use the reading column.

Strong's main page uses separate inner columns for its hero, sticky jump links,
editorial sections and entity band. Anchor measurements remain on the outer
sections, preserving scroll-to-section offsets. Its inner text width is 790 px,
matching the 830 px column with 20 px padding on each side.

The study DOM editor has the equivalent 830 px maximum in its stylesheet. Keep it
aligned with `PAGE_CONTENT_MAX_WIDTH` when changing the reading width.

When adding a page, verify at phone, tablet and wide browser sizes. Check populated
and empty states, headers with actions, long titles, filters and nested sheets.
Avoid calculating a component's width from the whole window when it can appear in
a narrower panel; use its measured layout (as the alphabet navigation does).

## Web runtime checks

The web startup loads the bundled UI and reading fonts before painting the app.
`webFontFamily` supplies matching CSS fallbacks for saved native font names; it
does not rewrite the user's stored font preference.

Expo DOM editors share the application document on web. A note's sizing and
placeholder styles must stay scoped to `.note-editor`. Only its standalone native
WebView may reset `html`/`body` height. A global `height: auto` collapses the app's
percentage-height navigation tree when a note is cached.

Interactive cards keep their primary navigation, tag chips and options menus as
sibling actions. Nested HTML buttons cause browser errors and ambiguous clicks.

The browser loads the bundled chronology geometry from its asset URL. Search
analytics and sheet footer insets expose the same callable interfaces needed by
the screen implementations on native and web.

# Home layouts

`HomeScreen` keeps the existing layout on native platforms and Web windows below
768 CSS pixels. From 768 pixels on Web, `DesktopHome.web.tsx` renders a two-column dashboard
home inside the existing workspace navigation. Its illustrations are bundled in
`src/assets/images/home/illustrations/`. Surface colors derive from the active
theme; personal library counters keep neutral icons. The main column contains the
daily verse, counters, three learning cards. The right
column contains bookmark resume, the current plan and Audibible. A 2 × 2 resource
discovery grid sits below the learning cards in the main column. The reference is
`output/imagegen/expo-web-home-2026-09-10/01-tableau-de-bord.png`.

The desktop daily verse uses the existing `VerseOfTheDay` data, sharing and image
actions. Previous/next buttons and directly selectable day indicators expose the
same five days as the compact carousel. Full verse text can expand the hero.
The resource discovery grid presents Hebrew, Greek, Nave and dictionary entries
on neutral surfaces with official framed resource icons and neutral text and
actions. Hebrew and Greek share the Strong icon and its blue.
Cards use a compact grid: category and icon-only shuffle share a 36px header
row in normal flow, above a centered entry (100px fixed). Strong entries show
only the original word and its translation; Nave and dictionary entries have no subtitle. The top-left icon
and label open the resource; the center opens the entry, and shuffle remains independent. Existing
queries and failure handling are retained through the widgets’ optional
`discovery` presentation. The grid uses two columns, and one below 560px of main-column allocation. Only DesktopHome uses this presentation;
NewTabContent keeps its existing design.

## Available-width layout

`desktop-home.css` is imported only by the Web entry point. The named `home`
inline-size container measures the actual allocation after the workspace sidebar
and route panel. Below 1040px it stacks the two dashboard columns; below 760px it
also stacks the header and secondary cards. The nested `home-main` container
controls counters, learning cards and random tools independently of window size.
The DOM/components stay mounted across these changes.

The daily verse uses `selectFontFamily`, the same current reading-font preference
as the Bible (not the legacy `bible.settings.fontFamily` field). On Web its text
fades in when the resolved verse changes; `AnimatedVerseHeight` observes intrinsic
content and transitions the outer height so following content moves with it.
Both transitions respect `prefers-reduced-motion`. Day controls stay mounted.

Browser regression scenario (CSS container layout needs a real browser, not Jest):

1. At a 1440px viewport, open Home and use Resume reading to open the right panel.
2. Show the left sidebar. The home allocation is about 680px: one dashboard column,
   three counters per row, two discovery cards per row; no clipped counts or controls.
3. At 1400px, learning cards become horizontal image/text rows in a single column.
4. Hide/show the sidebar with the panel open. Random words and the selected day
   must stay unchanged; the columns adjust to the new allocation.
5. Close the panel: the original two-column desktop design returns. Below the
   768px viewport gate, the existing compact home still renders.

Resume reading opens the current location and stored version of the latest
**added** bookmark, selected using `createdAt`, falling back to `date` for older
records. New bookmarks capture creation time; moving a legacy bookmark preserves
its known date before updating its activity date. Historic creation dates already
overwritten by older clients cannot be reconstructed. With no bookmarks, the
action opens the Bible without overriding the default location or version.

Random discovery refreshes refetch the current query, retaining its entry while
loading. The shuffle control is disabled during that request. The content row
keeps its fixed height across loading, success and failure states.

Changed discovery words fade in over 220ms. Only the inner entry content is
keyed by its original word and translation/title; links and shuffle controls
stay mounted. The opacity animation respects `prefers-reduced-motion`.

# Home

One composition (`HomeScreen.tsx`) for every platform and size. A phone, an iPad and a
desktop browser show the same sections in the same order; a wider column only lays their rows
out differently. There is no separate desktop home.

## Groups and parts

Four groups carry large titles (`HomeSectionTitle`). Parts inside a group carry small titles
(`HomeSubsectionTitle`), and groups are spaced more widely than parts, so the page reads as
four blocks rather than a list of equal sections.

1. **Header**: date, greeting, and the avatar to the profile. On the wide Web home the
   sidebar already shows the account, so the command-palette search (`HomeSearch.web.tsx`,
   ⌘K / Ctrl K) takes the avatar's place and wraps below the greeting in a narrow column.
2. **Aujourd’hui**: the verse or meditation of the day. Touch screens swipe the five days in a
   carousel (`UserWidget`). The wide Web home pages through the same days with previous/next
   buttons and dots, shows the full text and animates the card height
   (`HomeToday.web.tsx`, `AnimatedVerseHeight.web.tsx`).
3. **Ma bibliothèque**, what belongs to the reader: the six counters, the sign-in prompt,
   then the work in progress as parts (`HomeResumeSection`): **Reprendre** (latest History
   entries, hidden while the history is empty; « Tout voir » opens the full History) and
   **Mes plans** (followed reading plans, or an invitation to the catalogue). « À découvrir »
   leads to the catalogue, not to all the reader's plans, so it keeps its own wording; it
   only joins real plans, since the invitation already opens the catalogue. Title actions are
   verbs, never a second noun beside the title.
4. **Explorer**, what the app offers. Its title action, **Nouvel onglet**, adds an empty tab
   and switches to it, like the sidebar button. Below it, without a title, one shortcut per
   tab type of the new tab (`HomeOpenSection`), each opening the same scoped search
   (ADR-0045); then the four illustrated cards (`HomeExploreGrid`); then the **Un mot au
   hasard** part with random Greek, Hebrew, Nave and dictionary entries (`HomeDiscovery`).
5. **Aller plus loin**: Audibible and donation rows (`HomeGoFurther`).
6. **Footer** (`HomeFooter`): Follow and FAQ buttons on a raised panel for touch layouts; a
   row of links with the app download on the wide Web home.

## Width-driven layout

`homeLayout.tsx` measures the home column and gives each section the content width between
the gutters of 20 points. Sections choose their columns from that width, so the sidebar, a
route panel, an iPad split view or a rotation are all handled the same way. On Web the column
is read before the first paint, so grids never flash at the wrong count.

The column is capped at the general page width (`PAGE_CONTENT_MAX_WIDTH`, 830 points), like
the other pages of the workspace. A wider column left a large empty band beside the daily
verse, whose text stops at a reading width.

| Content width | Change                                                                                |
| ------------- | ------------------------------------------------------------------------------------- |
| < 620         | Phone layout: shortcuts and random words scroll horizontally                          |
| ≥ 620         | Shortcuts in two rows of five, random words in two columns, partner rows side by side |
| ≥ 680         | The six counters on a single row                                                      |
| ≥ 720         | The four Explorer cards and the four random words on a single row each                |
| ≥ 760         | Reprendre and Mes plans side by side, the history as a two-column grid                |
| ≥ 780         | All ten shortcuts on a single row, in cells without gaps                              |

`HomeGrid` lays out equal cells inside the gutters; cells stay in one parent, so a column
change re-wraps them without remounting their content (random words keep their entry).

## Details kept from earlier designs

- The daily verse uses `selectFontFamily`, the same reading-font preference as the Bible. On
  Web its text fades in when the resolved verse changes. Both transitions respect
  `prefers-reduced-motion`.
- Random entries are drawn at random, not per day; each card has its own shuffle button, which
  refetches its query while keeping the current entry, and is disabled during the request.
  Only the entry remounts when the word changes, which fades it in over 220ms on Web.
- `home.css`, loaded on Web only through `homeStyles.web.ts`, holds those animations and the
  shortcut key style. Column counts never come from CSS.

Browser regression scenario (the measured layout needs a real browser, not Jest):

1. At a 1440px viewport, open Home: one centred column of 830px, counters on one row,
   Reprendre beside Mes plans when the history has entries, ten shortcuts on one row with
   every label whole, four Explorer cards and four random words.
2. Narrow the window to 1024px: Reprendre and Mes plans stack, the shortcuts take two rows,
   random words and the selected day stay unchanged.
3. Open a route panel or hide the sidebar: the sections follow the new column width.
4. Below the 768px viewport gate, the carousel replaces the day buttons and the footer
   buttons replace the links.

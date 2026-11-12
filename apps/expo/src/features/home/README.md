# Home

One composition (`HomeScreen.tsx`) for every platform and size. A phone, an iPad and a
desktop browser show the same sections in the same order, in one column: the phone's home, only
a little wider on a large screen. Nothing sits side by side, and the daily verse keeps the
phone's size. There is no separate desktop home.

## Groups and parts

Below the header and the day, four groups carry large titles (`HomeSectionTitle`). Parts inside
a group carry the app's one section title (`HomeSubsectionTitle`, built on `ListSectionTitle`),
and groups are spaced more widely than parts, so the page reads as four blocks rather than a
list of equal sections.

The home is a hub (design-system README, « The app »): its ground is `canvas`, its content
sits in `surface` cards with no border and no shadow. The daily card and the event card take
the hub's large radius (24); the other cards take 16, tiles 8, buttons and chips the pill. Rows
grouped in one card (plans, the six counts, « Aller plus loin » on a phone) are separated by
hairlines. Only the floating close button carries `floatingShadow`.
The event card stays a deliberate dark feature card, and the Explorer illustrations keep the
light tint they were drawn on.

1. **Header**: date, greeting, and the avatar to the profile. On the wide Web home the
   sidebar already shows the account, so the command-palette search (`HomeSearch.web.tsx`,
   ⌘K / Ctrl K) takes the avatar's place and wraps below the greeting in a narrow column.
   Below it, only while Firebase has ended the session of the account shown, a card says the
   edits stay on the device and offers « Se reconnecter » (`SessionExpiredNotice`); offline it
   drops the button, since signing in needs a connection.
2. **The day**, with no title, since the date of the header already says it: the verse or
   meditation of the day, always in full. Touch screens swipe the
   five days in a carousel (`UserWidget`); every card takes the height of the day shown, 280
   points at least, so the sections below move when a day needs more room. The wide Web home
   pages through the same days with previous/next buttons and dots and animates the card height
   (`HomeToday.web.tsx`, `AnimatedVerseHeight.web.tsx`).
3. **Reprendre**, the work in progress, right after the day (`HomeResumeSection`): the latest
   History entries (« Tout voir » on the title opens the full History), then the **Mes plans**
   part (followed reading plans, or an invitation to the catalogue). While the history is
   empty, the group is « Mes plans » alone. The two parts stack at every width. A plan row ends in a round filled button with a
   chevron (`PlanContinueButton`), which reads « Continuer » or « Rattraper » aloud and opens
   the next reading; the row's detail already says how many days are behind. « À découvrir »
   leads to the catalogue, not to all the reader's plans, so it keeps its own wording; it only
   joins real plans, since the invitation already opens the catalogue. Title actions are verbs,
   never a second noun beside the title.
4. **Ma bibliothèque**, what belongs to the reader: the six counts in one card
   (`ProfileStats home`), then the sign-in prompt. The profile keeps the six cards.
5. **Explorer**, what the app offers: the four illustrated cards (`HomeExploreGrid`), their
   title alone on screen and their hint read aloud; then the **Un mot au hasard** part with
   random Greek, Hebrew, Nave and dictionary entries (`HomeDiscovery`). The home carries no
   shortcut per tab type: the new tab and the search already open each scoped search
   (ADR-0045).
6. **Aller plus loin**: Audibible, donation, Follow and FAQ, one line each with no description
   (`HomeGoFurther`), grouped in one card at every width.
7. **Footer** (`HomeFooter`): room for the floating close button on touch layouts; the app
   download as a link under a hairline on the wide Web home.

## Two columns on a large Web window

When the home gets 1080 points or more on the Web (`HomeScreen.tsx`), it sets two columns. The
width is the home's own, watched by `useWidePage`, so a panel opening beside it brings back the
single column. The
left one, 440 points, holds what is the reader's own: the header with the search under the
greeting, the day, « Ma bibliothèque ». It stays in place (`position: sticky`) while the right
one, the 640-point column, scrolls « Reprendre », « Explorer » and « Aller plus loin ». A left
column taller than the window scrolls with the page instead, so its end can always be reached.
Below 1080 points, and on every native app, the home is the single column. Each column is its
own `HomeLayout`, so sections still choose their rows from the width they get.

## Width-driven layout

`homeLayout.tsx` measures the home column and gives each section the content width between
the gutters of 20 points. Sections choose their columns from that width, so the sidebar, a
route panel, an iPad split view or a rotation are all handled the same way. On Web the column
is read before the first paint, so grids never flash at the wrong count.

The column is capped at 640 points (`HOME_MAX_WIDTH`), narrower than the other pages of the
workspace. At 830 every section changed shape (the verse set larger, the history beside the
plans, single rows of four or six), and the home no longer read like the phone's, which is the
one that works. The space left on each side of a large window is deliberate.

| Content width | Change                                                                          |
| ------------- | ------------------------------------------------------------------------------- |
| < 520         | Phone layout: history entries and random words scroll horizontally              |
| ≥ 520         | History entries and random words two by two, since a mouse cannot swipe the row |

The six counts stay on two rows of three and the Explorer cards two by two at every width. From
520 the Explorer card changes form: the tint fills the whole card (96 points), the illustration
sits on its left and the title in its bottom right corner, in the light themes' ink since the
tints stay light in every theme. A phone keeps the title under the tint, on the card's surface. The random words change form
at the same width: low cards of 76 points, the resource mark on the left, the word above its
category and gloss, the shuffle button on the right, where a phone keeps cards of 148 points.

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

0. At a 1600px viewport, open Home: the greeting, the day and the library on the left, the rest
   on the right. Scroll: the left column stays, the right one moves. At 1250px the home is one
   column again.
1. At a 1250px viewport, open Home: one centred column of 640px, the verse at the phone's size,
   the history two by two above Mes plans, the six counts on two rows, Explorer and the random
   words two by two, « Aller plus loin » in one card.
2. Narrow the window to 1024px: nothing changes but the margins.
3. Open a route panel or hide the sidebar: the column stays centred in the space it gets.
4. Below the 768px viewport gate, the carousel replaces the day buttons and the download link
   leaves the footer.

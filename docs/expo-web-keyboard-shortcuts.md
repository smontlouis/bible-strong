# Expo Web keyboard navigation

Every shortcut lives in one keymap,
`apps/expo/src/features/keyboard-shortcuts/keymap.ts`. The listeners match their
events against it, and the shortcuts guide, the settings page « Raccourcis
clavier » and the hints beside the selection actions print it. A shortcut that
is not in the keymap does not exist.

## Three families

A web page cannot have every key. Browsers keep Cmd/Ctrl+T, N, W, Q, L, R,
Cmd/Ctrl+1–9, Ctrl+Tab and the history keys, and some take Cmd+Option
combinations as well (Arc opens Little Arc with Cmd+Option+N, Safari closes the
other tabs with Cmd+Option+W). On Windows, Ctrl+Alt is AltGr on AZERTY and
other European layouts. The keymap never uses any of them; on macOS it also
leaves Control+arrows to Mission Control and Spaces.

- **Cmd (Ctrl elsewhere) + a letter**: the few globals every browser lets
  through: K, Shift+K, B, C, A.
- **Control on a Mac (Alt elsewhere) + a letter**: the workspace tabs. No browser
  takes this family.
- **A letter alone**: what the reader looks at, the Bible or the selection. It
  works only while no field has the focus, as in Gmail or GitHub.

One letter means one thing across the app. Shift gives the other action that
starts with the same letter, in French as in English: C compares and Shift+C
opens the commentary, T tags and Shift+T opens the themes, R opens the
references and Shift+R creates a relation.

## Workspace

| Action                                              | macOS            | Windows/Linux  |
| --------------------------------------------------- | ---------------- | -------------- |
| Command palette                                     | Cmd+K            | Ctrl+K         |
| Palette with the “Tab options” chip                 | Shift+Cmd+K      | Ctrl+Shift+K   |
| New workspace tab                                   | Control+T        | Alt+T          |
| Close current workspace tab                         | Control+W        | Alt+W          |
| Previous / next tab in sidebar order, across groups | Option+Up / Down | Alt+Up / Down  |
| Recent tabs switcher                                | Control+Q        | Alt+Q          |
| Toggle sidebar                                      | Cmd+B            | Ctrl+B         |
| Shortcuts guide                                     | ?                | ?              |

The recent switcher selects the previously visited tab first. Hold the modifier
and press Q again to advance, Shift+Q to reverse, or use Up/Down. Release Control
(macOS) or Alt (Windows/Linux) to activate; Enter also activates, Escape cancels.
Losing window focus cancels the switcher. Empty new-tab pages are excluded.

The new-tab button, the close button of the active tab and the sidebar button
show their shortcut in the browser's tooltip.

## Bible tab

| Action                         | Key           |
| ------------------------------ | ------------- |
| Previous / next chapter        | ← / →         |
| Next / previous verse          | J / K         |
| Extend the selection down / up | Shift+J / K   |
| Go to a verse of the chapter   | V             |
| Text → Strong → interlinear    | S             |

J and K move the selection itself: with no selection they select the first
verse under the reader's header, then the next or previous one; the menu
beside the verse follows. Shift extends from where the selection started, and
shrinks back past it. ← and → change chapter only without a selection, outside a
focused passage and outside annotation mode.

V opens Go to verse with the input focused; enter a verse number of the chapter
and press Enter. S cycles through the modes the main version has.

## Selected verses

| Annotate            | Key      | Study        | Key     | Share         | Key   |
| ------------------- | -------- | ------------ | ------- | ------------- | ----- |
| Highlight colour    | 1–9      | Lexicon      | S       | Copy          | Cmd+C |
| Remove highlight    | 0        | Dictionary   | D       | Select all    | Cmd+A |
| Note                | N        | Themes       | Shift+T | Share, Export | none  |
| Tags                | T        | References   | R       | Deselect      | Esc   |
| Link                | L        | Commentary   | Shift+C |               |       |
| Relation            | Shift+R  | Compare      | C       |               |       |
| Bookmark            | B        |              |         |               |       |
| Add to a study      | A        |              |         |               |       |
| Focus               | F        |              |         |               |       |

A key belongs to its action, not to the tab of the menu: N writes a note while
the Study tab shows. The digits pick the colours in the order of the bar and
are read from the key's position, so AZERTY works with or without Shift; the
colour already set is removed, as a click does. Actions the menu disables (the
study resources and the bookmark with several verses) ignore their key. Copy
leaves a hand-made text selection to the browser.

In annotation mode the menu takes N (note), T (tags), Shift+R (relations) and
Delete or Backspace (erase).

## Where keys go

The workspace and the Bible tab listen in the capture phase on `document`, the
selection menus on `window`. Every listener ignores composition, AltGr, editable
fields, and the keys of a modal dialog or menu (`isBlockingOverlayOpen`). The
menu beside the selected verses is a non-modal popover marked with
`data-keyboard-passthrough`: the workspace keys and J/K go on while it shows,
while the Bible tab's other letters (V, S, arrows) wait until it closes, so
that the selection owns its letters. Workspace and Bible keys also require the
workspace route and, for the Bible, the active tab.

## Menu integration

Screen-level MenuView and ContextualMenu instances opt in with `tabActions`.
ContextualPanel can expose `commands` whose callbacks use the same panel
navigation and action handlers as the menu. TabScreen provides the tab identity;
cached menus register against their own tab, never a global active-tab ID.
Row menus should not opt in. The command registry is transient, not persisted.

Cmd/Ctrl+Shift+K opens the palette directly with the “Tab options” chip,
including when the palette is already open. A leading `>` becomes the same
removable chip and replaces search results with actions from the current tab's
options menu; Backspace in the empty input returns to content search. Hidden
actions are omitted, disabled actions stay disabled, and destructive commands
use their existing confirmations.

## Guide and settings

`?` opens the shortcuts guide on its own; the palette footer opens the same
guide as “Shortcuts & help”, where Escape closes the guide first and the
palette keeps its query. Settings › « Raccourcis clavier » (web only) lists the
same sections with a filter. French and English copy lives under
`shortcutGuide.*`.

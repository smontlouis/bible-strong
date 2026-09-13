# Expo Web keyboard navigation

The global Cmd/Ctrl+K palette keeps its existing content search. Cmd/Ctrl+Shift+K
opens it directly with the “Tab options” chip, including when the palette is
already open. A leading `>`
becomes a removable “Tab options” chip and replaces search results with actions
from the current tab's options menu. The input then filters these actions. Clicking
the chip or pressing Backspace in the empty input returns to content search. Hidden actions are omitted, disabled actions stay
disabled, and destructive commands use their existing confirmations. On Home,
Settings, or an ordinary route there are no current-tab actions.

| Action                                              | macOS            | Windows/Linux |
| --------------------------------------------------- | ---------------- | ------------- |
| New workspace tab                                   | Cmd+Option+N     | Ctrl+Alt+N    |
| Close current workspace tab                         | Cmd+Option+W     | Ctrl+Alt+W    |
| Previous / next tab in sidebar order, across groups | Option+Up / Down | Alt+Up / Down |
| Recent tabs switcher                                | Control+Q        | Alt+Q         |
| Toggle sidebar                                      | Cmd+B            | Ctrl+B        |

The recent switcher selects the previously visited tab first. Hold the modifier
and press Q again to advance, Shift+Q to reverse, or use Up/Down. Release Control
(macOS) or Alt (Windows/Linux) to activate; Enter also activates, Escape cancels.
Losing window focus cancels the switcher. Empty new-tab pages are excluded.

Workspace shortcuts are suspended in inputs, editable documents, composition and
AltGr input, and while a dialog or menu is open. Closing requires the workspace
route. Browser shortcuts such as Cmd/Ctrl+T, W and Ctrl+Tab remain unchanged.

## Menu integration

Screen-level MenuView and ContextualMenu instances opt in with `tabActions`.
ContextualPanel can expose `commands` whose callbacks use the same panel
navigation and action handlers as the menu. TabScreen provides the tab identity;
cached menus register against their own tab, never a global active-tab ID.
Row menus should not opt in. The command registry is transient, not persisted.

## Bible tab shortcuts

- `V`: open Go to verse with the input focused. Enter a valid verse number in
  the current chapter and press Enter. Escape cancels. The same action is
  available under the Tab options chip in Cmd/Ctrl+K. A focused passage returns
  to its full chapter when navigating; repeated requests to the same verse scroll
  again without persisting a navigation counter.
- `S`: cycle Text → Strong → Reverse interlinear → Text. This uses the existing
  Strong selector availability and skips unavailable modes. Versions without
  Strong support are unaffected.

Both shortcuts require the active Bible tab on the workspace route. They ignore
editable fields, modal/menu interactions, modifiers, composition and key repeat.

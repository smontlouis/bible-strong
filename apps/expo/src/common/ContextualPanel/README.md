# ContextualPanel

Define one `screens` map with shared React Native content. The host uses HeroUI
Popover on Web and Sheet on native. Platform-specific imports belong to the host,
not the feature content.

Each screen supplies a title, optional header action and `content(navigation)`.
`navigation.open(name)` pushes a screen, `back()` returns one level, and `close()`
dismisses and resets the history. Filter/selection state belongs to the feature;
the panel only owns presentation and navigation. `trigger` must be visual content,
not another interactive button: the host supplies its accessible button.

FiltersHeader is the first shared consumer. Existing callbacks without screen
content remain supported by closing the panel before invoking the callback.
HighlightOptions, NoteOptionsPanel and BookmarkOptionsPanel also use the shared
host. PanelAction reuses ActionSheetItem on native to preserve the original
transparent rows, spacing, typography and separators. No automatic interception
of arbitrary sheet refs is introduced. Advanced color management still opens
the existing dedicated editor after closing this panel.

List rows use the shared PanelAction, FilterChoices, Box, Text and Checkbox
components. Their className props follow the standard Uniwind path (ADR-0044):
direct Tailwind CSS on Web and native styles on mobile. Do not add a separate
HTML row implementation merely to bypass class-to-style conversion.

The frame creates list content outside the stateful header layout so mounting
portal targets does not recreate that content. Lists which manage their own
virtualization must have a bounded scrolling viewport; clipping an unbounded
list with the outer `.bs-filter-options` element does not provide that viewport.
The version catalog bounds its own viewport and uses a smaller initial batch
only inside web panels. Keep the shared 200 ms transition independent of these
rendering optimizations.

The Web popover forwards the active palette as CSS variables via
`webThemeVariables`. Its body portal is outside Uniwind's `ScopedTheme`;
setting only the inherited `color` does not cover descendants with explicit
`text-default`, `text-grey`, or background utilities. Keep the palette on the
portal boundary so global component-library tokens cannot recolor its contents.

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

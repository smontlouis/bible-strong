# Universe colors

`universeColors.ts` owns the visual identity of Bible, Strong lexicon, dictionary,
Nave, commentaries, references, studies, notes and other study tools.

Change `universeColors` to recolor an identity across its consumers. Values are
existing theme tokens, except the commentary brand color. Do not use a highlight
slot (`color1`) to identify Bible passages: Bible uses neutral `tertiary`.

- `getUniverseColor(item)` returns the token for native components accepting theme colors.
- `resolveUniverseColors(palette, item)` returns foreground and a 12% tinted background.
  It is pure and accepts the palette received by an embedded DOM reader.
- Aliases connect `bible`, `passages`, `verse`; `note`, `notes`; `study`, `studies`;
  `commentary`, `commentary-resource`. Consumers keep labels and icon choices locally.

Consumers include tab icons, sidebar badges and drag previews, command palette,
search filters/section icons/result borders, relation icons in the native UI and
Bible DOM, resource action menus, settings resource links and resource SVG wrappers.

Selection/disabled colors, white icons over illustrations, user highlights and
editorial illustrations are contextual styling, not universe identity. Keep those
explicit at the callsite. The legacy study editor has its own inverted document
styles; migrating that document's full palette is separate from Bible DOM styling.

For new identity-colored UI, use the resolver rather than copying a palette token,
hex color or independently choosing a background tint into another feature.

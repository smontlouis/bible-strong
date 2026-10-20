# Universe colors

`universeColors.ts` owns the visual identity of Bible, Strong lexicon, dictionary,
Nave, commentaries, references and other study tools, and of what the reader makes:
highlights, bookmarks, notes, studies, links and tags.

Change `universeColors` to recolor an identity across its consumers. Values are
existing theme tokens, except the commentary brand color and three of the reader's
contents (bookmarks, links, tags): `primary` turns teal in the dark themes and
`quint` turns pink, so these keep fixed colors to stay apart in every theme. Do not
use a highlight slot (`color1`) to identify Bible passages: Bible uses neutral `tertiary`.

| Reader's content                  | Color               | Icon (`~common/personalContent`) |
| --------------------------------- | ------------------- | -------------------------------- |
| Highlights (and word annotations) | `secondary`, yellow | `edit-3`                         |
| Bookmarks                         | `#5983F0`, blue     | `bookmark`                       |
| Notes                             | `color2`, coral     | `file-text`                      |
| Studies                           | `tertiary`, slate   | `feather`                        |
| Links                             | `#26A69A`, teal     | `link`                           |
| Tags                              | `#8E6CEF`, violet   | `tag`                            |

`personalContentIcons` gives the icon of each one. Every list of these contents (the
account menu, the home library, a tag's page, the Bible text markers, the verse
selection actions, search and relations) takes both from there. A bookmark's own
color, chosen by the reader, stays the bookmark's.

- `getUniverseColor(item)` returns the token for native components accepting theme colors.
- `resolveUniverseColors(palette, item)` returns foreground and a 12% tinted background.
  It is pure and accepts the palette received by an embedded DOM reader.
- Aliases connect `bible`, `passages`, `verse`; `note`, `notes`; `study`, `studies`;
  `commentary`, `commentary-resource`; `annotation`, `highlight`, `highlights`;
  `bookmark`, `bookmarks`; `tag`, `tags`. Consumers keep labels and icon choices locally.

Consumers include tab icons, sidebar badges and drag previews, command palette,
search filters/section icons/result borders, relation icons in the native UI and
Bible DOM, resource action menus, settings resource links and resource SVG wrappers.

Selection/disabled colors, white icons over illustrations, user highlights and
editorial illustrations are contextual styling, not universe identity. Keep those
explicit at the callsite. The legacy study editor has its own inverted document
styles; migrating that document's full palette is separate from Bible DOM styling.

For new identity-colored UI, use the resolver rather than copying a palette token,
hex color or independently choosing a background tint into another feature.

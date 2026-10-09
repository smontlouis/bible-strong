# Bible Strong design system

The reference for the look of the public site, the videos and the share cards: colours, type, shapes, the mark, a few components, and the rules for using them. The app keeps its own themes in `apps/expo/src/themes/`.

It is published as a browsable page: https://claude.ai/artifact/Ae3GMkzJoTBQostwmcahcr (private until shared from the page).

## What is here

Everything under `project/` is the content of that page, in the layout its format expects.

| Path | What |
| --- | --- |
| `project/README.md` | The brand book: the usage rules. Read it first. |
| `project/tokens.json` | Every value: colours in light and dark, type, spacing, radii, shadow, layout. |
| `project/components/<Name>/` | A guideline (`README.md`) and a live preview (`preview.html`) for each component. `Cover` is the page's cover. |
| `project/components/bundle.css` | The stylesheet the share card previews have in common: the frame of every card. |
| `project/assets/Logos/` | The redrawn mark and the rules of the logo files. |
| `project/design-system.json` | The page's index: its title and the uploaded logo files. |

Fonts are not copied here. The page gets them from `apps/site/public/fonts/`, published under `project/fonts/` with the names `tokens.json` lists.

The pictures in the share card previews (two illustrations of the site, five pictures of the timeline) are not copied here either. They are uploads of the page, which the previews address as `/_blob/<id>`: a preview opened straight from this folder shows the cards without them.

## This folder is the reference

Change a value or a rule here, in a pull request, then publish the page from this folder. The page can also be edited in place: bring such an edit back here before publishing again, or it is overwritten.

The site and the videos do not read `tokens.json` yet. They hold their own copies of these values, in `apps/site/src/resource-pages.css`, `apps/site/src/styles.css` and each video's `frame.md`. Change them together.

## Related guides

- `docs/charte-graphique.md` and `docs/design/illustrations.md` rule the illustration style.
- `apps/expo/src/themes/UNIVERSE-COLORS.md` rules the identity colours of the app.

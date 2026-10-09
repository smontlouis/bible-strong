Bible Strong is a Bible study app and its public site: Bibles, the Strong lexicon of Hebrew and Greek, dictionaries, commentaries and topics, read side by side. This system covers the public site, the videos and the share cards. The app keeps its own themes and is only cited here.

Read the rules below, then take every value from `tokens.json`. Never copy a colour, a size or a radius from a screenshot or from another surface.

## Content

- **Two languages, French first.** Every public page exists in French and in English. Write the French first: it is the product's first language.
- **Address the reader as « vous »**, in the imperative: « Lisez la Bible en ligne gratuitement ». In English, plain imperatives: “Read the Bible online”.
- **Sentence case everywhere**, titles and buttons included: « Ouvrir dans l’app », not « Ouvrir Dans L’App ». Only `eyebrow` labels are uppercase, and the CSS does it, not the text.
- **A reference is written as the page prints it**: « Jean 3:16 », book name in the page's language, a colon, no space. The version follows in brackets by its code: « Jean 3:16 (LSG) ».
- **Typographic punctuation.** Curly apostrophe (’), French quotes with their spaces (« … »), an en dash between a title and its qualifier: « Lire la Bible en ligne – versions, numéros Strong et interlinéaire ».
- **Name things by what the reader sees**: « numéros Strong », « interlinéaire », « concordance ». Never the name of a table, a route or a pipeline.
- **No emoji, no exclamation mark, no marketing superlative.** The tone is the one of a study tool: precise, calm, generous. « Découvrir la Bible sous un nouveau jour. » is the tagline of the 2019 lockup and the most promotional line allowed.
- **Hebrew and Greek words keep their script**, followed by a transliteration in the sans family for readers who cannot read it.

## Colour

- **One ground, one ink.** Every public surface sits on `canvas`, a very pale blue, with text in `ink`, a midnight blue. Never pure white as a page ground, never pure black as text. `surface` is for cards on the canvas.
- **Blue is the only brand hue**, and it has three jobs that no single value can do. `brand` is for graphics and type of 24px and more: the logo dot, a rule, a progress bar. `cta` fills the one solid button of a view and may carry small text. `accent-ink` is for links and chip labels, on `canvas`, `surface` and `accent-soft`.
- **Never set small text in `brand`**: it reads at 3.3:1 on the canvas. On a `brand` fill, label in `ink`, never in white.
- **`muted` is for what supports the text**: eyebrows, verse numbers, captions. Body text is never muted.
- **`mark` is the only highlight**: a pale yellow behind a searched or examined word, whose text stays `ink`.
- **`words-of-jesus` is reserved** for the words of Jesus in reading text. It is not an error colour and not an accent.
- **The `universe-` colours identify a kind of resource in the app** (Strong, dictionary, topics, commentaries, references, Bible). Use them for an icon or a badge at a 12% tint, never for text on the canvas. The app defines their values per theme in `apps/expo/src/themes/`.
- **The `world-` tints are grounds for illustrations**: one per section of the landing page and per chapter of a video. They never tint an interface control. The illustration style itself is ruled by `docs/design/illustrations.md`.
- **Both themes are designed.** Dark is not an inversion: the canvas turns to a deep blue-black, the blues lighten, and the button label turns dark. Take the dark value of each token; do not derive it.

The blues were settled in October 2026: `blue-brand` for graphics, `blue-button` for what carries text, `blue-ink` for links. Three older values remain in code and are to be replaced when their file is next touched: `#496fda` (`--resource-accent` and `--landing-accent` on the site, now `blue-brand`), and `#385dae` and `#315fcf` (text accents in the videos' `frame.md`, now `blue-button`).

## Type

- **Two families in fixed roles.** The serif family (Literata) is for what is read: page titles, Bible text, definitions, articles. The sans family (Pulp Display) is for what is operated or scanned: navigation, buttons, chips, labels, numbers, and every heading of a video.
- **Titles are not bold.** A page title is `title` at weight 400; the size does the work. Inside a page, a section heading is `heading`, sans at weight 600.
- **Reading text is `prose`**, at a line height of 1.75, in a column of `measure` at most. A verse shown alone takes `passage`. Never justify it and never set it in the sans family.
- **What is set inside the text but is not the text switches family**: verse numbers and Strong references are sans, 0.72em, weight 600 (`verse-number`).
- **Weights in use**: 400 and 600 on pages, 500 for eyebrows, 800 for the headings of videos and the reference of a share card. Emphasis in prose is weight 600, never 700.
- **Eyebrows** are `eyebrow`: uppercase, tracked at 0.14em, in `muted`, above a title.
- **Until Pulp Display arrives**, the site falls back on Arial scaled to its width, so that lines do not move. Keep that fallback when adding a page.

## Shape, depth and layout

- **Round, never sharp.** Cards take `radius-xl`, buttons and chips `radius-pill`, a Strong reference `radius-sm`, a highlight `radius-mark`. No square corner anywhere.
- **Flat.** Depth comes from the lighter `surface` and a 1px `line` border. The only shadow is `shadow-reference`, the halo of a Strong reference in the text. The header is the canvas at 88% over a 12px blur.
- **One column.** A reading page is a single column of `measure` under a sticky header of `header-height`, with a side gutter of `space-5`. Spacing follows the 4px steps of the `space-` scale.
- **One solid element per view**: the `Button`. Everything else is text, a chip or a card.
- **Motion is short and serves reading**: 180ms with an ease-out curve on a control, nothing that loops, nothing on the text.

## The mark

The mark is a white disc, a grey ring lit from the top and a dot in `brand`. It carries its own disc and reads on any ground. Rules and files are in the `Logo` card and in `assets/Logos/README.md`. The 2019 icon, whose dot is `blue-legacy-logo`, is still the favicon and the header image of the site; replace it when either is next touched.

## Icons

Icons are outline icons from Lucide, in the colour of the text beside them. Small inline arrows (a menu chevron, a back arrow) are drawn inline as SVG at a 1.8px stroke with round caps and joins. No filled icon, no emoji, no icon without a visible or spoken label.

## The three surfaces

- **A page of the site.** The rules above are its rules. Its styles live in `apps/site/src/resource-pages.css` (`--resource-*` variables) and `apps/site/src/styles.css` (`--landing-*` variables).
- **A video frame.** 1920 by 1080, on `canvas`, in two columns: the explanation on the left, the real screen on the right. Headings are `frame-heading`, text is `frame-body` in a block of 740px at most. One `brand` accent, no second hue, no shadow. Screens are real captures, never redrawn.
- **A share card.** 1200 by 630, the image shown when a link is shared. Its design is the `VerseShareCard` card. The generator cannot read the site's CSS: it takes its values from `tokens.json`.

## When a value changes

`tokens.json` is the reference. The site and the videos do not read it yet: they hold their own copies of these values, in the files named above and in each video's `frame.md`. When a value changes here, change it there in the same pull request, and the other way round.

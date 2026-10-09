Bible text and study prose in the serif family, directly on the `canvas`, with the marks a reader meets in it: the verse number, the Strong reference, the highlight and the words of Jesus.

Set titles in `title` (or `title-compact` under 768px) and text in `prose`; a verse shown alone takes `passage`. Keep the column at `measure`. Everything set inside the text that is not the text switches to the sans family at 0.72em and weight 600: the verse number in `muted`, raised by 0.3em, and the Strong reference in `accent-ink` with `radius-sm` and `shadow-reference`. A highlighted word gets a `mark` ground with `radius-mark` and keeps its own colour. Words of Jesus take `words-of-jesus`. Bold in prose is weight 600, never 700.

The consumer provides the text and its marks. Never set reading text in the sans family, and never justify it. Sources: `.resource-prose`, `.bible-text` and `.strong-ref` in `apps/site/src/resource-pages.css`.

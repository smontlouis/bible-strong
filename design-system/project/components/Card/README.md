A `surface` panel with a 1px `line` border and `radius-xl` corners, holding one group of related content on the `canvas`.

Use it to set apart a block the reader can skip or open: a list of occurrences, a related entry, a call to open the app. Reading text itself sits directly on the canvas, never in a card. Padding `space-6`. No shadow: the border and the lighter fill do the lifting. Never nest a card in a card.

The consumer provides the content: usually an `eyebrow` in `muted`, a `heading`, then `body` text. Source: `.resource-card` in `apps/site/src/resource-pages.css`.

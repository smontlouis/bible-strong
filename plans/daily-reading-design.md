# Daily reading and plans — interface direction

Implementation companion to the agreed product specification. Both native and web are first-class surfaces.

## Existing visual language

Use the app's theme tokens, Box/Text/Paragraph primitives, shared Header, sheet system and reading-width constraints. Keep the current blue primary action, warm reading typography and understated secondary text. Do not introduce a competing palette, generic dashboard aesthetic or new UI framework.

## Daily verse card

One visual reading surface. Date comes first, followed by the quotation in the existing reading font and its biblical reference. The chosen collection is visible as source attribution, not mistaken for a biblical translation. A quiet source-change control is available in both standalone and collection mode. The primary reading action is distinct from compact share/reminder actions, each with at least a 44-point target.

On mobile, keep the quotation preview deliberate and expose the complete passage in the reader; long content cannot push controls outside the card. On desktop, use the existing generous quotation sizing and room for source attribution. If the mobile carousel's fixed height prevents legibility, adapt the enclosing widget rather than squeezing the text.

## Source library

A clear default-verse option precedes collection discovery. Collection cards have a consistent cover ratio, title, author/language, and an explicit selected state. Do not dim a selected collection: it remains readable and openable. Desktop uses a responsive grid; narrow screens retain comfortable text widths and touch targets. Selecting and previewing are separate actions. Detail pages/sheets reuse the cover and typography hierarchy so the transition feels continuous.

## Reading-plan cards and day view

Cards foreground the plan title, a concise schedule/progress summary and one Continue action. The day view distinguishes today's scheduled reading from missed readings using labels, not color alone. Progress must remain legible in dark mode. Calendar navigation does not imply a blocked or mandatory sequence.

## Reader

Use the established reading measure, font preferences and reference navigation. Opening passage and meditation body have different roles: passage gets a quieter tinted surface or generous spacing; body remains uncluttered. Avoid a card around every paragraph. Keep return/date navigation discoverable without interrupting the reading column.

## Quality checks

Inspect mobile and desktop together, light/dark palettes, long French titles and quotations, empty collections, missing leap-day entries, loading and retry states. Verify keyboard focus on web and accessibility labels on native. Keep transitions subtle and respect reduced motion. Use the existing sheet behavior and responsive breakpoints instead of inventing new navigation conventions for this feature.

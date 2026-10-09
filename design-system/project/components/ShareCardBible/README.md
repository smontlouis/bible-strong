The 1200 by 630 image shown when a Bible page is shared: a chapter, a verse, a long verse or a range of verses.

Every share card is the same frame, in `components/bundle.css` (classes `sc-…`): the `canvas`, the ring and the dot of the mark in the top right corner in `brand` at 12% opacity, a head, a body of 900px at most, and the lockup in the bottom left corner. The head names what the card is about in the sans family at 44px and weight 800, in `accent`, followed by one fact in a chip. Every title is in the sans family at weight 800, in `ink`; the serif family is kept for what is read: a verse, an excerpt, a gloss, an original word. The card is always in the light theme and in the language of the page.

- **A chapter** shows no text: the head is the version, the body is the reference at 160px with the number of verses under it. In the interlinear and Strong readings the chip names the reading and the line under the reference says what it adds.
- **A verse** is the reference in the head and the text as the figure, in the serif family at 52px, four lines at most.
- **A long verse** steps down to 46px and five lines, then to 38px and six lines. Beyond that it is cut at the last whole word, followed by an ellipsis. It is never set smaller.
- **A range** is set at 46px with its verse numbers kept, small and in `muted`, and cut the same way: the card shows where the passage starts, not all of it.

The consumer provides the reference as the page prints it, the version code and name, the text, and for a chapter its number of verses. Keep 64px clear above and below and 72px on the sides. A card without a picture is a flat PNG under 300 KB.

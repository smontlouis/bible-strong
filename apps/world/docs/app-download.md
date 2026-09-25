# App download in World

The yellow “Télécharger l’app” / “Download the app” shortcut stays beside reactions during exploration and opens https://bible-strong.app/ in a new tab. It is hidden during dialogs, editing, and on the stand display, where the existing join-World QR remains the primary invitation. The exhibit's caption also stays hidden on the stand, or when it would overlap the fixed actions or leave the viewport; the phone remains clickable.

A phone exhibit stands southwest of the central Bible. Phaser renders it with world depth; a projected HTML link covers the phone and its translated sign. Clicking it never requires proximity or moves the avatar. The pedestal footprint is present in both default and saved navigation; the phone itself does not block walking behind it. Asset bounds and ground footprint remain separate.

## Artwork

- Style: `bible-strong-univers-v1`, adapted to the existing island illustration.
- Generation: built-in `image_gen`.
- Runtime asset: `../public/assets/app-download/phone.webp` (transparent, 384 px high).
- Local master: `output/imagegen/app-download/phone-master.png` from repository root.
- References: `apps/world/public/assets/map/preview.webp` (perspective), `apps/site/public/images/landing/offline-library.webp` (drawing and palette).
- Blue/yellow/cream is a palette choice for this exhibit, not a new resource family.

### Exact generation prompt

Use case: illustration-story.
Asset type: transparent environment prop for Bible Strong World, bible-strong-univers-v1 adapted to its illustrated island map.
Input image 1: existing island map, reference for object perspective and illustrated environment. Input image 2: offline-library illustration, reference for rounded shapes, flat fills, fine ink details and restrained palette. Do not include the reference characters.
Subject: a single inviting upright smartphone displaying an open Bible symbol on a pale cream screen, standing on a small low oval sandstone display pedestal, a welcoming app-download exhibit for the central plaza. The phone is the dominant object, friendly rounded corners, thick deep-navy and blue case, pale screen, a blue open-book symbol centered in the top half and three short blue rounded lines suggesting a reading interface in the bottom half. A yellow circular medallion on the front of the pedestal has a simple navy downward download arrow.
Composition: one isolated complete object, mostly front facing with a subtle top-down three-quarter angle matching the map, screen easy to recognize at small size. Phone width about half the pedestal width, phone height about twice the pedestal height; compact wide pedestal with smooth stone edge. Art occupies 85% of a square image, centered, generous clean margin, no cropping.
Style: polished flat-color 2D illustration, large rounded masses, fine midnight-blue detail lines, subtle shade fills for perspective, limited blue/yellow/cream palette (a deliberate palette choice for this app exhibit). No systematic thick outer outline; retain fine lines around phone and stone.
Background: genuinely transparent alpha, including the corners; only a small soft contact shadow immediately below pedestal.
Constraints: no person, no hands, no scenery, no extra props, no floating sparkles, no lettering or readable words, no QR code, no app-store badges, no watermark, no photorealism, no 3D render, no white/checkerboard backdrop. Text will be added separately in code.

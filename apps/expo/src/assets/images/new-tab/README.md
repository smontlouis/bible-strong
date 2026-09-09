# New-tab illustrations

Style: `bible-strong-univers-v1`.

Generated with the built-in imagegen tool for the approved open new-tab composition. Blue for the Bible reader and coral for Notes are brief-specific choices, not new official feature color mappings. The UI uses existing application theme tokens independently.

## Assets

- `bible-reader.webp`: blue reader resting their cheek on one hand while reading.
- `notes-writer.webp`: coral reader writing in an open notebook.
- `library-reader.webp`: cyan reader holding books.

All are decorative (`accessible={false}`). Runtime WebP exports retain alpha and are at most 840 × 640 pixels. Full-resolution transparent PNG masters and a light/dark contact sheet are in `output/imagegen/new-tab-assets/`.

The built-in generator baked in a gray checkerboard twice. The user explicitly authorized local background removal. Neutral connected background regions were removed while retaining narrow enclosed book-detail strokes; a one-pixel fringe was removed and the mask lightly antialiased. The resulting images were visually checked against `#F4F7FF` and `#171923`, including faces, hands, page lines, and silhouettes.

## References

- Composition: `output/imagegen/nouvel-onglet-v2/06-composition-ouverte-affinee.png`
- Character drawing: `apps/site/public/images/landing/comparisons-universe.webp`
- Character drawing and coral palette: `apps/site/public/images/landing/relations-universe.webp`
- Art direction: `docs/design/illustrations.md`

## Exact generation prompts

### bible-reader

Create one production transparent PNG illustration for Bible Strong new-tab screen. Style identifier bible-strong-univers-v1. Image 1 is the approved UI composition reference: extract the specified scene concept ONLY, do not render any UI or text. Image 2 comparisons-universe.webp is the flat character drawing reference; Image 3 relations-universe.webp is drawing and coral palette reference. Large rounded flat color masses, symbolic monochromatic skin and clothing sharing one color family, expressive coherent hands, simple warm face, fine midnight-blue detail lines on hands/face/books but NO systematic outer outline around the silhouette. Clean flat fills with no gradient, no 3D, no texture. Transparent background with genuine alpha, no checkerboard or baked-in white/black background, no scenery, text, labels, logo or watermark. Isolated waist-up character, one readable action, cream pages with sparse fine strokes only. Keep all hands, hair and book within frame with 4% transparent margin; clean baseline crop at waist may be intentional. Square canvas. Match the approved character closely while improving independent cutout anatomy and edge quality.
Recreate the large BLUE reader at right of the Bible card in image 1: curly deep-blue short hair, round glasses, periwinkle blue face and shirt, right cheek resting on bent fist, other hand holding ONE open cream Bible in foreground, calmly absorbed in reading. Wide torso, horizontal scene aspect about 3:2 within square transparent canvas. The blue palette is chosen for this brief, not an official Bible feature color.

### notes-writer

Create one production transparent PNG illustration for Bible Strong new-tab screen. Style identifier bible-strong-univers-v1. Image 1 is the approved UI composition reference: extract the specified scene concept ONLY, do not render any UI or text. Image 2 comparisons-universe.webp is the flat character drawing reference; Image 3 relations-universe.webp is drawing and coral palette reference. Large rounded flat color masses, symbolic monochromatic skin and clothing sharing one color family, expressive coherent hands, simple warm face, fine midnight-blue detail lines on hands/face/books but NO systematic outer outline around the silhouette. Clean flat fills with no gradient, no 3D, no texture. Transparent background with genuine alpha, no checkerboard or baked-in white/black background, no scenery, text, labels, logo or watermark. Isolated waist-up character, one readable action, cream pages with sparse fine strokes only. Keep all hands, hair and book within frame with 4% transparent margin; clean baseline crop at waist may be intentional. Square canvas. Match the approved character closely while improving independent cutout anatomy and edge quality.
Recreate the small CORAL woman in Études et notes in image 1: dark navy hair in a bun, round glasses, coral skin and shirt, leaning forward writing with a blue pen in an open notebook resting in front. One hand writes, other steadies page, precise simple fingers. Coral palette selected for this brief, not an official Notes feature color. Only the woman, pen and notebook; no table, no network of links.

### library-reader

Create one production transparent PNG illustration for Bible Strong new-tab screen. Style identifier bible-strong-univers-v1. Image 1 is the approved UI composition reference: extract the specified scene concept ONLY, do not render any UI or text. Image 2 comparisons-universe.webp is the flat character drawing reference; Image 3 relations-universe.webp is drawing and coral palette reference. Large rounded flat color masses, symbolic monochromatic skin and clothing sharing one color family, expressive coherent hands, simple warm face, fine midnight-blue detail lines on hands/face/books but NO systematic outer outline around the silhouette. Clean flat fills with no gradient, no 3D, no texture. Transparent background with genuine alpha, no checkerboard or baked-in white/black background, no scenery, text, labels, logo or watermark. Isolated waist-up character, one readable action, cream pages with sparse fine strokes only. Keep all hands, hair and book within frame with 4% transparent margin; clean baseline crop at waist may be intentional. Square canvas. Match the approved character closely while improving independent cutout anatomy and edge quality.
Recreate the small CYAN/TURQUOISE reader in Bibliothèque in image 1: rounded curly teal hair, round glasses, cyan skin and clothing, holding two or three closed books against torso with both hands. Cheerful quiet expression. Pale pages and dark teal covers, no other props, no cloud, no links, no extra floating rays. The books and gripping hands must be coherent.

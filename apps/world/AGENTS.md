# Bible Strong World

Read the repository root `AGENTS.md`, this app's `CONTEXT.md`, and relevant system ADRs before changing behavior.

## Commands

```bash
yarn dev:world
yarn workspace @bible-strong/world typecheck
yarn workspace @bible-strong/world test
yarn workspace @bible-strong/world build
```

## Engineering rules

- Keep movement and navigation geometry independent from React.
- Preserve the 1671 × 941 source-image coordinate system unless the map asset and every annotation migrate together.
- Regenerate progressive map assets with `yarn workspace @bible-strong/world tiles <source>`; do not commit the full-resolution source image.
- Keep French and English interface copy synchronized. World supports only these two languages; use LSG for French Bible quotations and KJV for English.
- Treat navigation footprints and visual occluders as separate concerns.
- Keep segmentation inference offline; the browser ships only reviewed cutouts and metadata.
- The zone editor saves its validated navigation document directly to `public/navigation/archipelago.json` through the local Vite server.

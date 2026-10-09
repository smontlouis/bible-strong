# Share card service

Keeps the image shown when a page of `bible-strong.app` is shared, at
`https://cards.bible-strong.app/v1/<path of the page>` (ADR-0081).

The site draws; this Worker only keeps. It serves a stored image as it is, asks the site for a
missing one (`<site>/share-card/<path>`), stores it in the media bucket under `share-cards/v1/`
and, past seven days, has it drawn again in the background.

`src/content.ts` is the contract the site shares: what a card may show, the name of the meta
element a page writes it in, and how an image is addressed. Raise `SHARE_CARD_DESIGN` when the
design changes, so that every page gets a new address.

```bash
yarn workspace @bible-strong/share-card-service test
yarn workspace @bible-strong/share-card-service typecheck
yarn workspace @bible-strong/share-card-service dev --var SITE_ORIGIN:http://localhost:3210
yarn workspace @bible-strong/share-card-service worker:deploy
```

Deploy by hand, from an up-to-date `master`, after the site that draws the images is live.

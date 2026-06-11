# Bible Lexicon Maker

Utilities for building Bible lexicon data from Bible JSON files and Strong CSV files.

## Setup

```sh
npm install
```

## Scripts

```sh
npm run dev
npm run generate:strong -- --bible bds
npm run generate:strong:v2 -- --bible bds
npm run generate:strong:align -- --bible nbs
npm run generate:strong:reader -- --bible nbs
npm run viewer
npm run build
npm run typecheck
npm run lint
npm test
npm run format
```

`npm run generate:strong:reader` creates a fluent reader-mode Strong Bible calibrated against `Sg1910`, `Darby`, and `DarbyR`.

`npm run viewer` starts a local Strong file viewer for generated TSV outputs and `data/strongs/*.csv` source files.

## Data

- `data/bibles/`: Bible translations in JSON format.
- `data/strongs/`: Strong source files in CSV format.

Generated Bible outputs are written to `outputs/` by default. This directory is ignored by Git because generated Strong-tagged BDS text is a local artifact.

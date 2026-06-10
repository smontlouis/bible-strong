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
npm run build
npm run typecheck
npm run lint
npm test
npm run format
```

## Data

- `data/bibles/`: Bible translations in JSON format.
- `data/strongs/`: Strong source files in CSV format.

Generated Bible outputs are written to `outputs/` by default. This directory is ignored by Git because generated Strong-tagged BDS text is a local artifact.

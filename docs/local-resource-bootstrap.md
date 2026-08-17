# Bootstrap local des ressources

Cette procédure reste entièrement locale. Elle ne demande ni Neon, ni Cloudflare, ni une base de
production.

## 1. Produire et réconcilier les bundles

Dans Bible Lexicon Maker, chaque producteur écrit un dossier contenant `manifest.json`, un fichier
canonique JSON et son artefact `SQLite.zip` ou `JSON.zip`. Les commandes producteur existantes sont
regroupées par domaine :

```bash
npm run resources:publication:bibles -- --output <ordinary-root>
npm run resources:publication:strong-bibles -- --output-dir <strong-root>
npm run resources:publication:interlinear-bibles -- --output-dir <interlinear-root>
npm run resources:publication:strong-lexicon -- --output <lexicon-root>
npm run resources:publication:dictionary -- --output-dir <dictionary-root>
npm run resources:publication:nave -- build --output-dir <nave-root> ...
npm run resources:publication:supplementary -- build-all --output-dir <editorial-root> ...
npm run resources:publication:timeline -- build --output-dir <timeline-root> ...
```

Les options d’entrée restent celles de chaque producteur (sources éditoriales et fichiers
SQLite). Une fois les dossiers construits, le réconciliateur vérifie que les 72 identités du
catalogue sont présentes exactement une fois et que chaque bundle possède ses deux artefacts :

```bash
RESOURCE_PUBLICATION_ROOTS="<ordinary-root>:<strong-root>:<interlinear-root>:<lexicon-root>:<dictionary-root>:<nave-root>:<editorial-root>:<timeline-root>" \
  npm run resources:publication:reconcile
```

## 2. Importer dans PostgreSQL local

```bash
yarn resources:db:up
yarn resources:migrate
RESOURCE_PUBLICATION_ROOTS="<ordinary-root>:<strong-root>:<interlinear-root>:<lexicon-root>:<dictionary-root>:<nave-root>:<editorial-root>:<timeline-root>" \
  yarn resources:import-catalog
yarn resources:serve
```

`resources:import-catalog` découvre les manifests imbriqués, importe les dépendances dans l’ordre
(`bible-text`, lexique Strong, index Strong/interlinéaire, puis les autres domaines) et active les
révisions pour le développement local. Relancer la commande est sans reset : une révision inchangée
est simplement rapportée `unchanged`.

## 3. Smoke API

Avec l’API locale et le serveur d’artefacts déjà démarrés, un seul smoke couvre les six domaines
exposés par l’API :

```bash
RESOURCE_API_BASE_URL=http://127.0.0.1:8794 \
RESOURCE_ARTIFACT_BASE_URL=http://127.0.0.1:8795 \
  yarn resources:smoke:local
```

Les scripts individuels (`resources:smoke:bible-search`, `resources:smoke:dictionary`, etc.) restent
disponibles pour diagnostiquer un domaine précis. Ces smokes vérifient les appels HTTP, les contrats,
les révisions et les réponses de récupération ; ils ne remplacent pas les vérifications manuelles
iOS/Android.

Les vérifications iOS/Android et les parcours E2E restent séparés de cette procédure et sont à
exécuter manuellement.

La matrice des surfaces et des identités est disponible dans
[`docs/resource-evidence-matrix.md`](./resource-evidence-matrix.md).

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

## 2. Synchroniser PostgreSQL local

Avec l'organisation locale standard (`bible-strong-app` et `bible-lexicon-maker` côte à côte), cette
commande démarre PostgreSQL, applique les migrations et importe le catalogue canonique :

```bash
yarn resources:sync:local
```

Elle est à lancer au premier démarrage, puis uniquement lorsque les publications de Bible Lexicon
Maker ont changé. La base reste dans le volume Docker `resource-postgres-data` : cette commande ne
la détruit pas et les révisions déjà importées sont rapportées `unchanged`.

Pour synchroniser un autre emplacement :

```bash
yarn resources:db:up && \
  yarn resources:migrate && \
  RESOURCE_PUBLICATION_ROOTS="<ordinary-root>:<strong-root>:<interlinear-root>:<lexicon-root>:<dictionary-root>:<nave-root>:<editorial-root>:<timeline-root>" \
    yarn resources:import-catalog
```

`resources:import-catalog` découvre les manifests imbriqués et importe les dépendances dans l’ordre
(`bible-text`, lexique Strong, index Strong/interlinéaire, puis les autres domaines) et active les
révisions pour le développement local.

## 3. Démarrer l'API locale

Une fois la synchronisation initiale terminée, cette commande démarre PostgreSQL si nécessaire,
applique seulement les éventuelles nouvelles migrations, puis lance immédiatement l'API sur le port
8787 :

```bash
yarn resources:dev:local
```

Elle force `RESOURCE_SKIP_IMPORT=1` : même une ancienne variable `RESOURCE_PUBLICATION_ROOTS`
exportée dans le terminal ne peut donc pas relancer l'import. PostgreSQL et ses données persistent
entre deux lancements ; le processus HTTP de l'API doit rester ouvert pour la consultation en ligne.
Les téléchargements hors ligne passent par le Worker et son bucket R2 privé, indépendamment de l'API
locale. Pour tester volontairement une publication locale, démarrez le serveur d'artefacts avec le
bundle explicite :

```bash
RESOURCE_PUBLICATION_BUNDLE="<bundle-directory>" \
  RESOURCE_ARTIFACT_PORT=8788 yarn resources:serve:artifacts
```

Puis démarrez Expo avec `EXPO_PUBLIC_RESOURCE_ARTIFACT_BASE_URL=http://127.0.0.1:8788` pour le
simulateur iOS, `http://10.0.2.2:8788` pour l'émulateur Android, ou l'adresse LAN du Mac pour un
appareil physique.

## 4. Smoke API

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

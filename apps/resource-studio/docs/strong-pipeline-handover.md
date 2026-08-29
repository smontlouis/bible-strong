# Strong Pipeline Handover

Date: 2026-07-10

Ce document remplace l'ancien handover historique. Les anciens modes publics
`reader`, `hybrid` et `enriched` ont ete retires de l'API npm. La pipeline
canonique est maintenant centree sur un ledger Strong unique, puis sur des vues
exportees et des revues ciblees.

## Etat Actuel

- Commande principale: `npm run strong:generate -- --bible <id>`.
- Artefact canonique: `outputs/strong/<id>/bible-<id>-strong.sqlite`.
- Exports lecteur/avance: `npm run strong:export -- --bible <id> --view reader|advanced`.
- Diagnostic deterministe: `npm run strong:diagnose -- --bible <id>`.
- Evaluation gold: `npm run strong:evaluate -- --gold Sg1910|Darby|DarbyR`.
- Revue de trous/relocations: `npm run strong:review:gaps`.
- LLM seulement en review ciblee: `npm run strong:review:llm` ou packets agent.

La strategie produit reste: produire une Bible Strong lisible, proche du style
visible de `Sg1910`, `Darby` et `DarbyR`, avec STEP TAHOT/TAGNT comme
inventaire original de production.

## Workflow Recommande

### 1. Generer Le Ledger

```sh
npm run strong:generate -- --bible <id>
```

Sorties principales:

```text
outputs/strong/<id>/bible-<id>-strong.sqlite
outputs/strong/<id>/bible-<id>-strong-reader.tsv
outputs/strong/<id>/bible-<id>-strong-advanced.tsv
outputs/strong/<id>/bible-<id>-strong-metrics.json
```

### 2. Diagnostiquer

```sh
npm run strong:diagnose -- --bible <id>
```

Sorties:

```text
outputs/bible-<id>-strong-diagnostic.tsv
outputs/bible-<id>-strong-diagnostic.metrics.json
outputs/bible-<id>-strong-diagnostic.hard-verses.json
```

### 3. Evaluer Contre Les Golds

```sh
npm run strong:evaluate -- --gold Sg1910 --limit 1000 --backend diagnostic
npm run strong:evaluate -- --gold Darby --limit 1000 --backend diagnostic
npm run strong:evaluate -- --gold DarbyR --limit 1000 --backend diagnostic
npm run strong:evaluate -- --gold Sg1910 --limit 200 --backend canonical
npm run strong:evaluate -- --gold Darby --limit 200 --backend canonical
npm run strong:evaluate -- --gold DarbyR --limit 200 --backend canonical
```

### 4. Auditer Les Trous

Avant une revue LLM/humaine, on peut produire des candidats lexicaux externes
sans modifier le ledger:

```sh
npm run strong:lexical-candidates -- --bible <id> --only Gen.1-Gen.6
```

La sortie sert d'aide au tri: elle propose des mots candidats avec sources et
scores, mais ne place aucun Strong automatiquement.

```sh
npm run strong:review:gaps -- \
  --bible <id> \
  --only Gen.1 \
  --input-dir outputs/strong/<id> \
  --audit \
  --output-dir outputs/gap-review/<id>/Gen.1
```

Sorties:

```text
outputs/gap-review/<id>/Gen.1/gap-review-candidates.json
outputs/gap-review/<id>/Gen.1/gap-review-decisions.json
outputs/gap-review/<id>/Gen.1/gap-review-metrics.json
```

### 5. Construire Un Packet Agent

```sh
npm run strong:review:gaps:packet -- \
  --bible <id> \
  --only Gen.1 \
  --ledger-dir outputs/strong/<id> \
  --candidates outputs/gap-review/<id>/Gen.1/gap-review-candidates.json \
  --output outputs/gap-review/<id>/agent-packets/agent-packet-<id>-Gen.1.json
```

Le packet reduit le probleme a une decision auditable: `word`, `phrase`,
`empty`, `duplicate` ou `reject`. L'objectif est de corriger les trous et les
placements faibles, pas de refaire la generation avec un LLM.

### 6. Valider En Preview, Appliquer Par Le Batch

```sh
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/<review>.json \
  --output-dir outputs/gap-review/<id>/agent-review/<review>-validated \
  --candidates outputs/gap-review/<id>/Gen.1/gap-review-candidates.json
```

Cette commande directe sert a la validation et au preview. Meme avec
`--finalize-reference-style`, elle ne constitue jamais un chemin d'application
production. `semanticRefillAgentReview --apply` refuse maintenant toute
ecriture sans le verrou et le marqueur de transaction detenus par le batch.

Pour appliquer en production, construire d'abord un plan stable puis lancer le
batch:

```sh
npm run strong:review:gaps:batch -- \
  --bible <id> \
  --lexical-report outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-all.json \
  --output-root outputs/gap-review/<id>/<run> \
  --plan-only

npm run strong:review:gaps:batch -- \
  --bible <id> \
  --lexical-report outputs/lexical-candidates/<id>/bible-<id>-lexical-candidates-all.json \
  --output-root outputs/gap-review/<id>/<run> \
  --skip-existing
```

Le batch fixe la pagination et l'appartenance des candidats aux taches. Le
second modele est adaptatif au niveau candidat, mais une application exige
toujours le meme choix borne provenant de deux identites de modeles distinctes,
le filtre lexical courant, un contrat v2 et une transaction avec rollback. Il
n'existe pas encore de skip pre-LLM general sur la seule base d'une decision
terminale historique.

Regenerer ensuite le ledger si un rebuild complet est necessaire:

```sh
npm run strong:generate -- --bible <id>
```

### 7. Auditer Ou Migrer Les Artefacts Historiques

Les sources plain `semantic-refill:llm` et
`semantic-refill:llm-reference-style` sont toujours en quarantaine. Seule
`semantic-refill:llm-consensus-filtered` est eligible en production.

```sh
npm run strong:review:gaps:migrate-artifacts -- --bible <id>
npm run strong:review:gaps:migrate-artifacts -- --bible <id> --apply
```

Toujours inspecter le dry-run avant `--apply`. Une promotion exige un candidat
`missing` encore ouvert, une cible courante, une preuve lexicale directe
actuelle, deux modeles distincts d'accord sur le meme choix borne, et aucun
replacement, relocation ou conflit de carrier. Sur NBS, 313 des 2 411 artefacts
raw ont ete promus; 2 098 restent en quarantaine. Le journal reconstruit contient
2 480 decisions (2 043 `accepted-safe`, 437 `needs-witness-review`), tandis que
5 379 auto-acceptations legacy single-model restent en quarantaine.

## Modules Importants

- `src/strongLedger.ts`: generation canonique et exports.
- `src/diagnoseStrong.ts`: diagnostic deterministe et hard verses.
- `src/evaluateStrongGold.ts`: evaluation masked-gold.
- `src/semanticRefill.ts`: audit des trous et relocations.
- `src/semanticRefillAgentPacket.ts`: packets agent contraints.
- `src/semanticRefillAgentReview.ts`: validation/application de decisions.
- `.agents/skills/bible-to-strong/SKILL.md`: procedure agent principale.
- `.agents/skills/bible-to-strong/references/workflow.md`: workflow detaille.

## Decisions Produit

- Le ledger est la source de verite.
- Les vues `reader` et `advanced` sont des exports, pas des modes de generation.
- Le diagnostic ne doit pas etre confondu avec la sortie produit.
- Le LLM intervient seulement en review ciblee, avec validation locale.
- L'application LLM production passe exclusivement par le batch transactionnel
  et son consensus exact de deux modeles distincts.
- Les Strong legitimes deviennent `word`, `phrase` ou `empty`.
- `pending` doit rester un etat transitoire, pas une sortie finale souhaitee.
- STEP TAHOT/TAGNT est l'inventaire original de production. Les Strong
  classiques servent a comparer les references, tandis que les `dStrong` STEP
  gardent la precision lexicale.
- Les donnees WLC/SBLGNT peuvent servir d'audit/provenance, mais elles ne
  doivent pas creer de clefs de dictionnaire produit. Les suffixes WLC/SBLGNT
  (`H6960a`, etc.) ne sont pas normalises en Strong cliquables.

## Derniere Baseline NBS

La generation finale du 2026-07-10 contient 31 169 versets, 363 503 Strong
reader, 486 297 Strong advanced, 95 456 occurrences empty et 5 369 phrases.
La couverture carrier reference est `0.8593`, le carrier original `0.8029`, la
representation originale `0.9999`, les trous semantiques `395`, le risque de
placement `6 831` et la qualite structurelle `0.9808`. Les couvertures token
reader/advanced sont `0.4912`/`0.5204`. Le run complet a pris 156.32 s et environ
4.33 GB RSS max.

## Checks

Avant de conclure une modification:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run format:check` peut signaler des fichiers historiques non touches; pour
une refacto ciblee, verifier au minimum les fichiers modifies avec Prettier.

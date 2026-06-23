# Strong Pipeline Handover

Date: 2026-06-23

Ce document remplace l'ancien handover historique. Les anciens modes publics
`reader`, `hybrid` et `enriched` ont ete retires de l'API npm. La pipeline
canonique est maintenant centree sur un ledger Strong unique, puis sur des vues
exportees et des revues ciblees.

## Etat Actuel

- Commande principale: `npm run strong:generate -- --bible <id>`.
- Artefact canonique: `outputs/strong/<id>/bible-<id>-strong-ledger.json`.
- Exports lecteur/avance: `npm run strong:export -- --bible <id> --view reader|advanced`.
- Diagnostic deterministe: `npm run strong:diagnose -- --bible <id>`.
- Evaluation gold: `npm run strong:evaluate -- --gold Sg1910|Darby|DarbyR`.
- Revue de trous/relocations: `npm run strong:review:gaps`.
- LLM seulement en review ciblee: `npm run strong:review:llm` ou packets agent.

La strategie produit reste: produire une Bible Strong lisible, proche du style
visible de `Sg1910`, `Darby` et `DarbyR`, sans forcer toute l'inventaire
WLC/SBLGNT dans la vue lecteur.

## Workflow Recommande

### 1. Generer Le Ledger

```sh
npm run strong:generate -- --bible <id>
```

Sorties principales:

```text
outputs/strong/<id>/bible-<id>-strong-ledger.json
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
npm run strong:evaluate -- --gold Sg1910
npm run strong:evaluate -- --gold Darby
npm run strong:evaluate -- --gold DarbyR
```

### 4. Auditer Les Trous

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

### 6. Valider Et Appliquer

```sh
npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/<review>.json \
  --output-dir outputs/gap-review/<id>/agent-review/<review>-validated \
  --candidates outputs/gap-review/<id>/Gen.1/gap-review-candidates.json

npm run strong:review:gaps:apply -- \
  --bible <id> \
  --input outputs/gap-review/<id>/agent-review/<review>.json \
  --output-dir outputs/gap-review/<id>/agent-review/<review>-applied \
  --candidates outputs/gap-review/<id>/Gen.1/gap-review-candidates.json \
  --apply
```

Regenerer ensuite le ledger:

```sh
npm run strong:generate -- --bible <id>
```

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
- Les Strong legitimes deviennent `word`, `phrase` ou `empty`.
- `pending` doit rester un etat transitoire, pas une sortie finale souhaitee.
- Les donnees originales WLC/SBLGNT servent de garde-fou et d'inventaire, pas
  de contrainte de visibilite lecteur exhaustive.

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

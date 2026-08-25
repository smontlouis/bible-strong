# Mature LLM Gap-Review Workflow

## Objectif

Transformer la passe LLM `strong:review:gaps` en workflow mature,
mesurable et productisable pour ameliorer les Strong visibles en Reader sans
perdre le controle deterministe du ledger canonique.

Le but n'est pas de rendre le LLM generateur principal. Le but est de prouver,
mesurer, puis industrialiser une boucle:

```text
canonical ledger
-> gap candidates
-> compact packet
-> bounded LLM review
-> local validation
-> selective apply
-> refresh/generate
-> before/after report
```

## Contexte Actuel

Une premiere passe pilote a ete executee sur `nbs` / Genese avec un lot de 30
candidats:

- modele: `deepseek/deepseek-v4-flash`;
- decisions brutes: 30;
- decisions validees: 30;
- placements visibles haute confiance appliques: 4;
- exemples appliques:
  - `Gen.12.1 H1980 -> va-t'en`;
  - `Gen.13.3 H1980 -> rendit`;
  - `Gen.16.8 H1980 -> vas-tu`;
  - `Gen.18.22 H1980 -> repartirent`;
- delta Genese apres refresh:
  - `readerVisibleStrongCount`: `+4`;
  - `emptyStrongCount`: `-6`;
  - `readerTaggedTokenCount`: `+7`;
  - `placementRiskCount`: `-1`.

La passe a aussi revele et corrige deux besoins de maturite:

- la finalisation reference-style doit etre limitee au packet source, pas au
  livre entier;
- le packet builder doit inclure seulement les versets concernes par les
  candidats du lot.

## Etat Au 2026-06-29

Outillage ajoute:

- `strong:review:gaps:llm` pour appeler AI Gateway sur un packet compact;
- `strong:review:gaps:report` pour produire un resume JSON/Markdown;
- `strong:review:gaps:lexical-packet` pour construire des packets semantiques
  compacts depuis les rapports `strong:lexical-candidates`;
- `strong:review:gaps:consensus` pour construire une review consensus visible
  haute confiance depuis deux sorties modele validees;
- `strong:review:gaps:packet --min-priority semantic-medium` pour bloquer un
  benchmark semantique avant appel LLM si la queue ne contient aucun candidat
  semantique;
- `--finalize-reference-style` pour finaliser les candidats valides du packet
  en `word`, `phrase` ou `empty` basse confiance;
- packet builder compacte: seuls les versets references par les candidats sont
  inclus.

Rapport de decision:

- `reports/llm-gap-review-production-maturity.md`

Benchmarks disponibles:

- Gen / DeepSeek: 30 decisions brutes, 30 validees, 4 placements visibles haute
  confiance appliques, `readerVisibleStrongCount +4`;
- Gen compact courant / DeepSeek: 30 decisions brutes, 30 validees, 0 placement
  visible haute confiance, 96345 tokens;
- Gen compact courant / `openai/gpt-5.4-mini`: 29 decisions brutes, 1 decision
  manquante finalisee en `empty`, 0 placement visible haute confiance, 79419
  tokens;
- Rom / DeepSeek: 30 decisions brutes, 30 validees, 0 placement visible haute
  confiance;
- Rom / Gemini Flash Lite: 0 decision parseable, 30 decisions manquantes
  finalisees en `empty`.
- Ezek / DeepSeek: 30 decisions brutes, 30 validees, 0 placement visible haute
  confiance, 11 placements visibles basse confiance, 116138 tokens;
- Ezek / `openai/gpt-5.4-mini`: 29 decisions brutes, 1 decision manquante, 25
  validees, 5 rejets `duplicate`, 0 placement visible haute confiance, 93273
  tokens.
- Gen et Ezek avec `--min-priority semantic-medium`: echec attendu
  `no-candidates-at-or-above-priority:semantic-medium`, ce qui prouve que ces
  queues sont des lots de retenue `function-low`, pas des queues semantiques.
- Ezek lexical medium/open / DeepSeek: 30 decisions brutes, 27 validees, 23
  placements visibles haute confiance, 138681 tokens;
- Ezek lexical medium/open / `openai/gpt-5.4-mini`: 29 decisions brutes, 25
  validees, 22 placements visibles haute confiance, 115585 tokens;
- Ezek lexical consensus exact: 16 placements visibles haute confiance, 16
  valides, 0 rejet, appliques puis refresh `Ezek`;
- delta Ezek apres refresh consensus:
  - `emptyStrongCount`: `-16`;
  - `readerTaggedTokenCount`: `+18`;
  - `readerTokenCoverage`: `+0.0005`;
  - `referenceStrongCarrierCoverage`: `+0.0008`;
  - `placementRiskCount`: `-2`.
- 1Cor lexical high-only / DeepSeek: 15 decisions brutes, 12 validees, 3
  rejets, 12 placements visibles haute confiance, 63011 tokens;
- 1Cor lexical high-only / `openai/gpt-5.4-mini`: 15 decisions brutes, 15
  validees, 0 rejet, 15 placements visibles haute confiance, 52412 tokens;
- 1Cor lexical consensus exact: 7 placements visibles haute confiance, 7
  valides, 0 rejet, appliques puis refresh `1Cor`;
- delta 1Cor apres refresh consensus:
  - `emptyStrongCount`: `-14`;
  - `readerTaggedTokenCount`: `+15`;
  - `readerTokenCoverage`: `+0.0015`;
  - `referenceStrongCarrierCoverage`: `+0.0020`;
  - `placementRiskCount`: `-1`.
- Acts lexical high-only / DeepSeek: 13 decisions brutes, 11 validees, 2
  rejets, 10 placements visibles haute confiance, 45829 tokens;
- Acts lexical high-only / `openai/gpt-5.4-mini`: 13 decisions brutes, 12
  validees, 1 rejet, 10 placements visibles haute confiance, 39181 tokens;
- Acts lexical consensus exact: 8 placements visibles haute confiance, 8
  valides, 0 rejet, appliques puis refresh `Acts`;
- delta Acts apres refresh consensus:
  - `emptyStrongCount`: `-6`;
  - `readerTaggedTokenCount`: `+10`;
  - `readerTokenCoverage`: `+0.0005`;
  - `referenceStrongCarrierCoverage`: `+0.0003`;
  - `placementRiskCount`: `-4`.

Conclusion courante:

- continuer sur un benchmark borne;
- ne pas appliquer largement;
- DeepSeek est plus complet mais plus couteux en tokens;
- `gpt-5.4-mini` est moins couteux mais manque parfois une decision et peut
  emettre des `duplicate` terminaux;
- la priorite suivante n'est plus de multiplier les modeles sur les memes lots
  `function-low`, mais de construire une queue plus semantique et plus
  susceptible de produire des placements visibles haute confiance.
- les packets lexicaux sont maintenant la source prioritaire pour les
  benchmarks high-yield; l'application doit passer par un consensus exact ou un
  arbitre valide, jamais par une sortie modele brute.
- Ezek, 1Cor et Acts donnent maintenant trois validations positives du workflow
  lexical + deux modeles + consensus. Le prochain elargissement doit rester un
  batch controle consensus-only, cappe par livre, pas une application large
  d'une sortie modele brute.
- Premier batch controle execute ensuite:
  - scopes testes: `Hos`, `Lev`, `2Sam`, `Rev`, `Amos`;
  - consensus exact total avant filtre: 60 decisions;
  - filtre securite automatique: retrait de 8 decisions `Hos` trop generiques
    (`vais`, `ferai`, `fera`, `fasse`, `celle`, `quoi`), 3 decisions `2Sam`
    tenues pour revue temoin (`faisait`, `vais`, `fit`), et 1 stacking
    `Rev.5.1 dos`;
  - `Lev`: consensus 21 decisions valide; l'apparent blocage refresh a ensuite
    ete isole comme probleme de performance scoped-refresh. Apres cache des
    sources lexicales, les 21 decisions filtrees ont ete appliquees et verifiees.
    `strong:refresh -- --bible nbs --only Lev` termine en 132.06s avec 7.46 GB
    RSS max apres application; delta incremental `Lev`: `emptyStrongCount -15`,
    `readerTaggedTokenCount +21`, `placementRiskCount -5`;
  - applique et refresh: 27 decisions sur `Hos`, `2Sam`, `Rev`, `Amos`;
  - delta global batch: `emptyStrongCount -40`, `readerTaggedTokenCount +47`,
    `readerTokenCoverage +0.0001`, `placementRiskCount -6`.
- Nouvelle regle: le consensus exact n'est pas suffisant seul; utiliser le
  filtre post-consensus automatique avant application pour porteurs generiques,
  stacking meme cible, et delta risque positif.
- Deuxieme batch borne execute le 2026-06-30:
  - scopes testes: `2Kgs.1-5`, `1Pet.1-5`, `Rom.1-5`;
  - consensus exact total avant filtre: 20 decisions;
  - filtre automatique: 17 safe, 3 tenues pour revue temoin (`fais`,
    `faisant`, `existe`);
  - applique et refresh: 17 decisions sur `2Kgs`, `1Pet`, `Rom`;
  - delta global batch: `emptyStrongCount -42`, `readerTaggedTokenCount +48`,
    `readerTokenCoverage +0.0000`, `placementRiskCount -6`;
  - nouvelle regle ajoutee: une decision visible sans token temoin et sans
    support Strong dans `Sg1910`, `Darby`, ou `DarbyR` reste en revue humaine,
    meme si les deux modeles sont d'accord.

## Fichiers A Lire

- `.agents/skills/bible-to-strong/SKILL.md`
- `.agents/skills/bible-to-strong/references/workflow.md`
- `src/semanticRefill.ts`
- `src/semanticRefillAgentPacket.ts`
- `src/semanticRefillAgentReview.ts`
- `src/semanticRefillLlm.ts`
- `src/runSemanticRefillPacketLlm.ts`
- `tests/semanticRefillLlm.test.ts`

## Phase 1: Stabiliser L'Outillage

Verifier et completer:

- `strong:review:gaps:packet` produit des packets compacts;
- `strong:review:gaps:llm` appelle AI Gateway et ecrit une review JSON
  compatible avec `strong:review:gaps:apply`;
- `strong:review:gaps:apply --finalize-reference-style`:
  - garde les `word` / `phrase` mecaniquement valides;
  - convertit les targets unsafe en `empty` basse confiance;
  - remplit les decisions manquantes du packet en `empty`;
  - ne finalise jamais des candidats absents du packet source.

Ajouter des tests si une de ces garanties n'est pas couverte.

## Phase 2: Construire Un Benchmark Rejouable

Creer 3 a 5 packets representatifs sur `nbs`:

- un lot `function-low` de mouvement/verbes faibles dans Genese;
- un lot avec candidats de livres narratifs hors Genese;
- un lot NT si les candidats existent;
- un lot avec relocation/suspicious stacking;
- un lot avec vrais porteurs semantiques visibles quand disponible.

Chaque packet doit etre:

- petit: 30 a 50 candidats;
- compact: seulement les versets concernes;
- stable: conserve sous `outputs/gap-review/<id>/agent-packets/`;
- documente dans le rapport avec nombre de candidats, Strong dominants,
  taille fichier, modele appele, tokens et temps.

## Phase 3: Comparer Les Modeles

Sur les memes packets, comparer au minimum:

- `deepseek/deepseek-v4-flash`;
- un modele plus fort disponible via AI Gateway;
- si possible le workflow 2 proposeurs + arbitre documente dans le skill.

Mesurer:

- decisions brutes par type: `word`, `phrase`, `empty`, `duplicate`,
  `not-rendered`, `reject`;
- decisions validees;
- decisions rejetees;
- finalisations `empty` dues a unsafe target;
- decisions manquantes;
- placements visibles haute confiance;
- placements visibles basse confiance;
- cout tokens;
- temps mur;
- exemples bons;
- exemples rejetes ou dangereux.

## Phase 4: Application Controlee

Ne pas appliquer tout ce qui valide automatiquement.

Regle conseillee pour la premiere vague:

- appliquer seulement `word` / `phrase` avec `confidence >= 0.84`;
- exclure les targets avec stacking suspect;
- exclure les mots faibles;
- garder les `empty` basse confiance comme artefact de review, pas comme
  override durable, sauf decision produit explicite.

Appliquer avec:

```sh
npm run strong:review:gaps:apply -- \
  --bible nbs \
  --input outputs/gap-review/nbs/agent-review/<review-visible-high>.json \
  --output-dir outputs/gap-review/nbs/agent-review/<review-visible-high>-applied \
  --candidates outputs/gap-review/nbs/<scope>/gap-review-candidates.json \
  --apply
```

Puis rafraichir:

```sh
NODE_OPTIONS=--max-old-space-size=8192 npm run strong:refresh -- --bible nbs --only <BookOrScope>
```

## Phase 5: Rapport Avant/Apres

Creer:

```text
reports/llm-gap-review-production-maturity.md
```

Inclure:

- commandes exactes;
- packets testes;
- modele(s);
- tokens/cout/temps;
- nombre de decisions brutes;
- nombre de decisions validees;
- nombre applique;
- exemples appliques;
- exemples refuses;
- delta metriques:
  - `readerVisibleStrongCount`;
  - `emptyStrongCount`;
  - `referenceStrongCarrierCoverage`;
  - `originalStrongCarrierRate`;
  - `readerTaggedTokenCount`;
  - `readerTokenCoverage`;
  - `placementRiskCount`;
  - `placementQuality`;
- conclusion claire: le LLM ameliore-t-il assez pour justifier le cout?

## Commandes De Base

```sh
npm run strong:review:gaps -- --bible nbs --only <scope> --audit --output-dir outputs/gap-review/nbs/<scope>
npm run strong:review:gaps:packet -- \
  --bible nbs \
  --only <scope> \
  --candidates outputs/gap-review/nbs/<scope>/gap-review-candidates.json \
  --output outputs/gap-review/nbs/agent-packets/agent-packet-nbs-<scope>-limit<N>.json \
  --limit <N>
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run strong:review:gaps:llm -- \
  --input outputs/gap-review/nbs/agent-packets/agent-packet-nbs-<scope>-limit<N>.json \
  --output outputs/gap-review/nbs/agent-review/llm-review-nbs-<scope>-limit<N>-<model>.json \
  --model <model>
npm run strong:review:gaps:apply -- \
  --bible nbs \
  --input outputs/gap-review/nbs/agent-review/llm-review-nbs-<scope>-limit<N>-<model>.json \
  --output-dir outputs/gap-review/nbs/agent-review/llm-review-nbs-<scope>-limit<N>-<model>-validated \
  --candidates outputs/gap-review/nbs/<scope>/gap-review-candidates.json \
  --finalize-reference-style
```

Rapport benchmark:

```sh
npm run strong:review:gaps:report -- \
  --packet outputs/gap-review/nbs/agent-packets/agent-packet-nbs-<scope>.json \
  --review outputs/gap-review/nbs/agent-review/<review>.json \
  --validation-dir outputs/gap-review/nbs/agent-review/<review>-validated \
  --applied-dir outputs/gap-review/nbs/agent-review/<review>-applied \
  --before-metrics outputs/gap-review/nbs/baseline/bible-nbs-strong-metrics-before-<scope>.json \
  --after-metrics outputs/strong/nbs/bible-nbs-strong-metrics.json \
  --metrics-scope <scope> \
  --output-json reports/llm-gap-review-nbs-<scope>.json \
  --output-md reports/llm-gap-review-nbs-<scope>.md
```

## Criteres D'Acceptation

- Au moins 3 packets representatifs sont testes.
- Au moins 2 modeles ou 2 strategies LLM sont compares sur le meme packet.
- Le rapport indique cout, qualite, risques et decision de go/no-go.
- Les placements appliques sont limites aux decisions visibles haute confiance.
- Les metriques avant/apres prouvent une amelioration ou justifient l'arret.
- Les tests passent:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Condition D'Arret

S'arreter et documenter si:

- les gains restent marginaux face au cout;
- le LLM propose trop de stacking dangereux;
- les validations locales doivent convertir la majorite des `word` en `empty`;
- les packets restent trop couteux malgre la compaction;
- les overrides ne peuvent pas etre promus durablement a cause de `data/`
  ignore.

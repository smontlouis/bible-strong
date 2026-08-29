# Phrase-Aware Strong Production Second Pass

## Objectif

Faire une seconde passe de production sur les Bibles francaises Strong deja generees, maintenant que le projet sait gerer les affectations Strong sur plusieurs mots.

Le but n'est pas de repartir de zero. Le but est de reprendre la pipeline hybride mature, d'exploiter les corrections humaines deja enregistrees, de detecter les cas ou un Strong doit porter sur une phrase plutot que sur un seul mot, de regenerer les Bibles, puis de ne laisser a l'utilisateur qu'un residuel vraiment ambigu.

## Bibles cibles

- `bds`
- `bfc`
- `fmar`
- `frc97`
- `nbs`
- `nfc`
- `nvs78p`
- `ost`

Ajouter `s21` seulement si `data/bibles/bible-s21.json` existe et si la pipeline locale peut la traiter sans recuperation manuelle supplementaire.

## Lire d'abord

- `.agents/skills/bible-to-strong/SKILL.md`
- `.agents/skills/bible-to-strong/references/workflow.md`
- `goals/phrase-aware-strong-alignment-v2.md`
- `goals/multi-bible-strong-generation-review.md`
- `reports/hybrid-strong-report.md`
- `reports/hybrid-gold-evaluation-report.md`
- `reports/strong-generation-multi-bible-report.md`
- `src/readerAlignment.ts`
- `src/phraseTranslationLexicon.ts`
- `src/curatedStrongOverrides.ts`
- `src/generateStrongHybrid.ts`
- `src/llmReview.ts`
- `src/runLlmReviewBooks.ts`
- `src/translationProfiles.ts`
- `viewer/reviewer.js`
- `data/curated-strong-overrides.json`
- les manifests existants sous `outputs/llm-books/<bible>/`

## Contexte important

L'utilisateur a corrige les derniers `pending-human` dans l'interface de revue. Commencer par verifier que ces decisions ont bien ete sauvegardees durablement dans `data/curated-strong-overrides.json` et/ou dans les fichiers de decisions applicables.

La pipeline doit maintenant accepter trois types de cible:

- `word`: Strong attache a un mot visible;
- `phrase`: Strong attache a une expression contigue de plusieurs mots;
- `empty`: Strong conserve sans mot francais visible fiable.

Ne jamais confondre `reject` avec "supprimer un Strong necessaire". Un rejet doit vouloir dire: proposition fausse, doublon, ou Strong deja represente ailleurs.

## Travail attendu

### 1. Auditer l'etat courant

Verifier:

- les Bibles JSON presentes sous `data/bibles/`;
- les manifests LLM existants par Bible;
- les decisions restantes `pending`, `pending-human`, `accept`, `reject`;
- les overrides `word`, `phrase`, `empty` dans `data/curated-strong-overrides.json`;
- que `outputs/` est bien ignore par Git.

Produire un etat initial dans le rapport:

- pending par Bible;
- nombre d'overrides phrase;
- nombre d'overrides empty;
- dernier fichier de sortie disponible par Bible.

### 2. Appliquer les corrections humaines existantes

Si les corrections existent dans les fichiers de review mais pas encore dans les overrides durables, les appliquer avec:

```sh
npm run review:llm:apply -- --bible <id> --decisions outputs/llm-books/<id>/llm-review-<id>-merged-decisions.json
```

Si les corrections sont deja dans `data/curated-strong-overrides.json`, ne pas les dupliquer.

Preserver toutes les modifications utilisateur non liees.

### 3. Regenerer toutes les Bibles cibles

Regenerer avec la pipeline hybride:

```sh
for bible in bds bfc fmar frc97 nbs nfc nvs78p ost; do
  npm run generate:strong:hybrid -- --bible "$bible"
done
```

Verifier que les sorties contiennent bien les cibles phrase:

```sh
rg 'data-target="phrase"' outputs/bible-*-strong-hybrid.tsv
```

Les sorties completes restent sous `outputs/` et ne doivent pas etre committees.

### 4. Mesurer l'effet phrase-aware

Collecter pour chaque Bible:

- versets generes;
- total Strong tags;
- token coverage;
- visible Strong rate;
- empty Strong rate;
- phrase Strong count;
- learned phrase count;
- curated phrase count;
- original representation rate;
- original unrepresented Strong occurrences;
- hard verse count.

Comparer avec les rapports ou metriques precedents quand ils existent. L'objectif est de savoir si les phrases reduisent les mauvais attachements a un seul mot, pas seulement si elles augmentent le volume de tags.

### 5. Refaire une evaluation gold

Apres tout changement de logique d'alignement ou de rendu, lancer au minimum:

```sh
npm run evaluate:strong:hybrid -- --gold Sg1910 --limit 1000
npm run evaluate:strong:hybrid -- --gold Darby --limit 1000
npm run evaluate:strong:hybrid -- --gold DarbyR --limit 1000
```

Si les resultats sont stables ou meilleurs et que le temps le permet, lancer aussi les memes evaluations sans `--limit`.

Stopper et documenter si la precision ou le F1 regresse clairement.

### 6. Identifier les nouveaux cas phrase utiles

Analyser les pires versets restants, surtout ceux ou:

- le Strong est attache a un mot tete trop pauvre;
- l'equivalent francais est une locution;
- le Strong est represente par une construction syntaxique;
- la version source de reference a plusieurs mots pour une seule idee;
- un `empty` pourrait etre remplace par une phrase visible fiable.

Ajouter des corrections seulement si elles sont defendables par:

- au moins une Bible Strong de reference locale;
- l'inventaire original WLC/SBLGNT ou STEP;
- le contexte du verset;
- et, si besoin, une suggestion LLM relue.

### 7. Utiliser le LLM seulement pour les cas durs

Ne pas relancer aveuglement 8 Bibles x 66 livres avec un gros quota.

Si les manifests existants sont suffisants, les reutiliser. Sinon creer une passe separee phrase-v2, par livre, avec un petit quota:

```sh
set -a; . ./.env; set +a
AI_GATEWAY_TIMEOUT_MS=120000 npm run review:llm:books -- \
  --bible <id> \
  --books all \
  --concurrency 3 \
  --llm-limit 25 \
  --model deepseek/deepseek-v4-flash \
  --skip-existing
```

Si le script permet un dossier de sortie dedie, utiliser:

```text
outputs/llm-books-phrase-v2/<id>/
```

Le prompt ou la validation doivent permettre:

- `target: "word"` avec `wordIndex`;
- `target: "phrase"` avec `startWordIndex`, `endWordIndex`, `normalizedPhrase`;
- `target: "empty"` quand aucun mot francais fiable ne porte le Strong.

Auto-accepter uniquement les cas mecaniquement surs. Les suggestions phrase LLM doivent etre appliquees durablement seulement apres validation par les regles de confiance ou review.

### 8. Ne laisser qu'un petit residuel humain

Creer ou mettre a jour un fichier global de review si des cas restent vraiment ambigus:

```text
outputs/llm-books/pending-human-review.json
```

Ce fichier doit:

- charger dans `viewer/review.html`;
- distinguer `word`, `phrase`, `empty`;
- afficher la raison de l'ambiguite;
- permettre de corriger une phrase seulement quand l'item est en mode `A revoir`;
- ne contenir que les cas qu'un agent ne peut pas trancher serieusement.

Objectif: eviter de demander a l'utilisateur de verifier des centaines ou milliers de cas. Tout ce qui est objectivement resolvable doit etre resolu par l'agent.

### 9. Regenerer apres decisions

Apres application des decisions retenues:

```sh
for bible in bds bfc fmar frc97 nbs nfc nvs78p ost; do
  npm run generate:strong:hybrid -- --bible "$bible"
done
```

Verifier de nouveau les metriques et les pending.

### 10. Mettre a jour la documentation et le skill

Mettre a jour si necessaire:

- `.agents/skills/bible-to-strong/SKILL.md`
- `.agents/skills/bible-to-strong/references/workflow.md`
- `reports/phrase-aware-strong-production-second-pass.md`
- `reports/strong-generation-multi-bible-report.md`
- les rapports individuels `reports/strong-generation-<id>.md` si les chiffres ont change.

Le skill doit expliquer clairement le workflow humain:

1. lancer le skill ou la commande de generation;
2. ouvrir le manifest de review seulement s'il reste des vrais `pending-human`;
3. corriger `word`, `phrase` ou `empty`;
4. cliquer `Enregistrer decisions`;
5. relancer l'application des decisions puis la generation.

## Verification finale

Executer:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

Verifier aussi:

```sh
git check-ignore outputs/bible-bds-strong-hybrid.tsv
git status --short
```

Le commit final ne doit inclure que:

- code source;
- tests;
- docs;
- rapports;
- overrides durables non copyrightes.

Il ne doit pas inclure les TSV complets generes ni les gros artefacts sous `outputs/`.

## Livrables

- Bibles locales regenerees sous `outputs/bible-<id>-strong-hybrid.tsv`.
- Metriques sous `outputs/bible-<id>-strong-hybrid.metrics.json`.
- Rapport: `reports/phrase-aware-strong-production-second-pass.md`.
- Review residuelle, seulement si necessaire: `outputs/llm-books/pending-human-review.json`.
- Skill mis a jour si le workflow phrase/empty/word n'est pas assez explicite.
- Tests couvrant au minimum:
  - rendu phrase sans tags imbriques;
  - absence de doublon Strong entre phrase et mots couverts;
  - application d'une decision review `phrase`;
  - application d'une decision review `empty`;
  - generation normale `word`.

## Criteres d'acceptation

- Les 8 Bibles cibles se generent ou chaque blocage est documente precisement.
- Les corrections humaines deja faites sont appliquees durablement.
- Les phrases sont representees par un seul wrapper `<w>` quand c'est le bon choix.
- Les metriques phrase-aware sont disponibles par Bible.
- Les evaluations gold limitees passent sans regression claire.
- Le nombre final de `pending-human` est nul ou tres faible et justifie.
- L'utilisateur n'a pas a verifier une masse de cas resolvables automatiquement.
- Le skill documente le vrai workflow de generation + review + regeneration.
- `format:check`, `typecheck`, `lint`, `test`, `build` passent.
- Les sorties completes restent ignorees par Git.

## Conditions d'arret

Arreter et documenter si:

- les credits ou la cle AI Gateway sont indisponibles pour une passe LLM necessaire;
- une source Bible cible manque;
- une regression gold importante apparait;
- les cas restants demandent un jugement editorial humain reel;
- la pipeline actuelle ne permet pas encore d'appliquer durablement un type de decision necessaire.

Dans tous les cas, ecrire:

- ce qui a ete fait;
- ce qui reste;
- les metriques courantes;
- le nombre de pending par Bible;
- les commandes exactes pour reprendre.

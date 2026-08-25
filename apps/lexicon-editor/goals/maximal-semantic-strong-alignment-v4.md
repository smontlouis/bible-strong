# Maximal Semantic Strong Alignment V4

## Objectif

Construire la meilleure passe suivante de generation Strong pour les Bibles
francaises locales, avec un objectif explicite: reduire les trous visibles sur
les mots semantiques importants.

Le probleme constate sur les sorties hybrides actuelles est que la precision est
bonne, mais la couverture utile reste trop conservatrice. Des mots comme
`humains`, `Nephilim`, `Seigneur`, `regretter`, `genealogie`, `pervertir` ou
`aneantir` peuvent manquer alors qu'ils ont une equivalence Strong defendable
dans le verset.

La V4 doit donc passer d'une logique "tagger seulement ce qui est facile" a une
logique "rendre compte de chaque Strong attendu du verset", sans forcer les
particules non traduites sur des mots francais artificiels.

## Bibles cibles

Traiter en priorite:

- `nbs`
- `bds`
- `bfc`
- `fmar`
- `frc97`
- `nfc`
- `nvs78p`
- `ost`
- `s21` si `data/bibles/bible-s21.json` existe localement

Commencer par un pilote profond sur `nbs` et quelques chapitres difficiles
visuellement inspectes, puis generaliser aux autres Bibles.

## Lire d'abord

- `.agents/skills/bible-to-strong/SKILL.md`
- `.agents/skills/bible-to-strong/references/workflow.md`
- `goals/semantic-complete-strong-alignment-v3.md`
- `goals/phrase-aware-production-second-pass.md`
- `reports/semantic-complete-strong-v3-report.md`
- `reports/strong-generation-multi-bible-report.md`
- `data/discovery.md`
- `src/generateStrongHybrid.ts`
- `src/readerAlignment.ts`
- `src/semanticStrongV3.ts`
- `src/translationLexicon.ts`
- `src/phraseTranslationLexicon.ts`
- `src/translationProfiles.ts`
- `src/llmReview.ts`
- `src/runLlmReviewBooks.ts`
- `src/originalSource.ts`
- `src/strongCsv.ts`
- `data/curated-strong-overrides.json`
- `viewer/review.html`
- `viewer/reviewer.js`
- `viewer/index.html`
- `viewer/strong-viewer.js`

## Principe produit

Le but n'est pas d'avoir 100% des mots originaux accroches a des mots francais.
Le but est d'avoir 100% des Strong attendus expliques:

- `visible-word`: Strong place sur un mot francais fiable;
- `visible-phrase`: Strong place sur une expression francaise contigue;
- `empty`: Strong conserve car l'original existe mais aucun mot francais fiable
  ne le porte;
- `duplicate-represented`: Strong deja represente ailleurs dans le verset;
- `not-rendered`: element original volontairement non rendu;
- `wrong-source-or-variant`: Strong attendu par une source mais non pertinent
  pour cette tradition textuelle;
- `pending-human`: vrai cas ambigu qui doit rester rare.

Un Strong semantique important ne doit pas disparaitre seulement parce que le mot
francais est un synonyme moderne ou une locution.

## Strategie technique attendue

### 1. Ledger par verset

Ajouter ou renforcer un "Strong ledger" par verset.

Pour chaque verset, construire:

- inventaire original WLC/SBLGNT;
- inventaire des references locales `Sg1910`, `Darby`, `DarbyR`;
- inventaire deja place dans la Bible cible;
- liste des Strong manquants;
- statut final de chaque Strong attendu.

Le ledger doit permettre de repondre a cette question:

> Pour ce verset, quels Strong etaient attendus, ou sont-ils passes, et pourquoi?

Produire une sortie JSON sous:

```text
outputs/semantic-v4/<bible>/<scope>/strong-ledger.json
```

Si le fichier est trop gros, utiliser un manifest + fichiers par livre.

### 2. Priorisation semantique

Classer les trous avant de les corriger.

Priorite haute:

- noms propres;
- noms communs importants;
- verbes;
- adjectifs/adverbes semantiques;
- concepts theologiques;
- personnes, lieux, nombres significatifs;
- expressions francaises qui rendent un seul Strong original.

Priorite moyenne:

- relations utiles;
- complements semantiques;
- locutions qui changent la lecture.

Priorite basse:

- articles;
- marqueurs objet;
- particules;
- prepositions faibles;
- suffixes ou elements morphologiques non visibles;
- mots originaux manifestement non rendus.

Les priorites doivent dependre du profil de traduction:

- Bible formelle (`fmar`, `ost`, `nvs78p`): couverture plus dense acceptee;
- Bible lisible-formelle (`nbs`, `s21`): densite moyenne, lisibilite preservee;
- Bible dynamique (`bds`, `bfc`, `frc97`, `nfc`): moins de tags, mais tags
  semantiques importants mieux couverts.

### 3. Cascade de resolution avant LLM

Avant de demander au LLM, tenter dans cet ordre:

1. cible deja evidente par match exact, lemme, stem robuste ou phrase apprise;
2. transfert depuis `Sg1910`, `Darby`, `DarbyR` dans le meme verset;
3. equivalent Strong depuis lexique francais local et gloss STEP/original;
4. equivalences semantiques controlees par Strong;
5. detection de phrase multi-mots;
6. detection de doublon deja represente;
7. decision `empty` ou `not-rendered` pour les particules/mots non rendus;
8. seulement ensuite: agent/LLM.

La cascade doit corriger les familles connues sans rester ad hoc:

- `H0120`: homme, humain, etre humain, personne;
- `H5162`: repentir, se repentir, regretter;
- `H7843`: corrompre, pervertir, detruire, aneantir;
- `H5303`: geant, Nephilim;
- `H8435`: generation, posterite, genealogie, descendance;
- `H3068`: Eternel, Seigneur, Yahweh selon le contexte original.

Ajouter les nouvelles familles seulement avec preuve originale/reference.

### 4. Phrase-aware obligatoire

La V4 doit gerer les Strong sur plusieurs mots.

Exemples:

- `dans la mesure ou` peut porter un Strong si c'est l'equivalent naturel;
- `etre humain` peut porter un Strong unique;
- une locution verbale peut porter un Strong verbal.

Les decisions phrase doivent contenir:

- `startWordIndex`;
- `endWordIndex`;
- `normalizedPhrase`;
- `strong`;
- preuve reference/original;
- confiance;
- raison.

Le viewer/reviewer doit permettre de voir et corriger ces phrases.

### 5. Agents et LLM

Utiliser les agents/LLM comme proposeurs de decisions, pas comme source finale.

Workflow recommande:

- creer des work items par livre ou chapitre selon la taille;
- traiter plusieurs livres/chapitres en parallele si les outils multi-agent sont
  disponibles;
- sinon utiliser les scripts concurrents existants;
- envoyer au LLM un paquet ferme: texte cible, tags actuels, trous priorises,
  references Strong locales, inventaire original, schema JSON attendu;
- demander explicitement de ne pas inventer de Strong absent de l'inventaire;
- demander de choisir entre `word`, `phrase`, `empty`, `duplicate`,
  `not-rendered`, `pending-human`.

Modele par defaut:

```text
deepseek/deepseek-v4-flash
```

Utiliser un modele plus fort seulement pour les residus vraiment difficiles et
documenter le cout. Utiliser `AI_GATEWAY_KEY` via Vercel AI Gateway si
disponible.

### 6. Validation centrale stricte

Toute decision d'agent ou de LLM doit passer par un validateur local.

Refuser automatiquement:

- Strong absent de l'inventaire original/reference du verset;
- index de mot invalide;
- phrase non contigue ou qui ne correspond pas au texte cible;
- fonction-word faible quand le Strong est semantique et qu'une meilleure cible
  existe;
- doublon non justifie;
- cible qui contredit toutes les references locales;
- confiance trop basse;
- decision qui degrade fortement l'evaluation gold.

Accepter automatiquement seulement:

- Strong present dans original/reference;
- cible francaise visible compatible;
- preuve locale suffisante;
- confiance au-dessus du seuil du profil;
- pas de conflit avec un tag deja place.

Les cas restants doivent aller dans `pending-human`, mais l'objectif est d'en
laisser tres peu.

### 7. Application durable

Les decisions validees doivent etre sauvegardees dans:

```text
data/curated-strong-overrides.json
```

Elles doivent supporter:

- `word`;
- `phrase`;
- `empty`;
- `duplicate-represented`;
- `not-rendered`;
- `pending-human` pour les residus non appliques.

Ne pas appliquer aveuglement des milliers de suggestions sans rapport de
validation.

### 8. Generation finale

Regenerer chaque Bible apres application:

```sh
npm run generate:strong:hybrid -- --bible <id> --output-dir outputs/semantic-v4/current-<id>-full
```

Les TSV complets et artefacts volumineux restent sous `outputs/` et ne doivent
jamais etre commits.

## Commandes a ajouter ou renforcer

Si elles n'existent pas deja, ajouter des commandes npm proches de:

```sh
npm run strong:v4:ledger -- --bible nbs --only Gen
npm run strong:v4:plan -- --bible nbs --only Gen --chunk-size chapter
npm run strong:v4:agent-review -- --bible nbs --only Gen --concurrency 4
npm run strong:v4:validate -- --bible nbs --input outputs/semantic-v4/nbs/Gen/decisions
npm run strong:v4:apply -- --bible nbs --input outputs/semantic-v4/nbs/Gen/validated-decisions.json
npm run strong:v4:report -- --bible nbs --scope Gen
```

Si des commandes V3 existent deja et suffisent, les etendre plutot que dupliquer
inutilement.

## Pilote obligatoire

Avant de generaliser, prouver la methode sur:

- `nbs` Genese 6;
- au moins un chapitre `bds` difficile;
- au moins un chapitre `bfc` ou `frc97` dynamique;
- au moins un chapitre formel `fmar` ou `ost`;
- un chapitre NT avec phrases/locutions.

Verifier visuellement que les trous semantiques critiques sont reduits.

Pour `nbs` Genese 6, les mots suivants doivent etre audites explicitement:

- `humains` / `etre humain`;
- `Nephilim`;
- `Seigneur`;
- `regretta` / `regrette`;
- `genealogie`;
- `pervertie` / `pervertis`;
- `aneantir`.

## Mesures a rapporter

Pour chaque Bible:

- versets generes;
- Strong tags totaux;
- couverture token;
- taux visible;
- taux empty;
- nombre de phrases Strong;
- nombre de Strong attendus;
- nombre de Strong semantiques attendus;
- nombre de Strong semantiques visibles;
- nombre de Strong semantiques `empty`;
- nombre de `duplicate-represented`;
- nombre de `not-rendered`;
- nombre de `pending-human`;
- top livres/chapitres avec trous semantiques;
- comparaison avant/apres V4;
- evaluation gold `Sg1910`, `Darby`, `DarbyR`;
- estimation cout LLM.

Le score le plus important n'est pas seulement la couverture token: c'est la
reduction des trous semantiques visibles sans perte importante de precision.

## Reports attendus

Produire ou mettre a jour:

```text
reports/maximal-semantic-strong-v4-report.md
reports/strong-generation-multi-bible-report.md
reports/strong-generation-<id>.md
```

Le rapport V4 doit expliquer:

- ce qui a ete resolu automatiquement;
- ce qui a ete resolu par LLM/agents;
- ce qui a ete applique durablement;
- ce qui reste humainement ambigu;
- pourquoi certains Strong restent `empty` ou `not-rendered`;
- les limites connues.

## Review humaine

L'utilisateur ne doit pas avoir a verifier des milliers de cas.

S'il reste des cas humains, produire:

```text
outputs/semantic-v4/pending-human-review.json
```

Ce fichier doit etre chargeable dans:

```text
http://localhost:4173/viewer/review.html?review=/outputs/semantic-v4/pending-human-review.json
```

Il ne doit contenir que:

- vrais conflits semantiques;
- variantes textuelles;
- locutions trop ambigues;
- cas ou les references locales divergent fortement;
- cas ou le LLM/agent ne peut pas trancher proprement.

## Verification finale

Executer:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

Executer aussi les evaluations gold au minimum en limite 1000:

```sh
npm run evaluate:strong:hybrid -- --gold Sg1910 --limit 1000
npm run evaluate:strong:hybrid -- --gold Darby --limit 1000
npm run evaluate:strong:hybrid -- --gold DarbyR --limit 1000
```

Si possible, lancer les evaluations gold completes sans `--limit`.

## Contraintes

- Ne jamais committer les TSV complets generes.
- Ne jamais committer de Bible complete copyrightable.
- Garder les gros artefacts sous `outputs/`.
- Ne pas degrader fortement la precision gold pour gagner de la couverture.
- Ne pas relancer des appels LLM deja faits si des fichiers exploitables existent.
- Continuer les autres Bibles si une Bible echoue.
- Documenter tout blocage avec commande exacte de reprise.

## Criteres d'acceptation

- La V4 prouve sur pilote qu'elle corrige des trous semantiques que la V3
  laissait passer.
- Les sorties finales sont regenerees pour toutes les Bibles cibles possibles.
- Chaque Strong attendu important est `visible-word`, `visible-phrase`, `empty`,
  `duplicate-represented`, `not-rendered`, `wrong-source-or-variant` ou
  `pending-human`.
- Les phrases multi-mots fonctionnent dans generation, validation, rendu et
  review.
- Les suggestions LLM/agents passent par validation locale avant application.
- Les `pending-human` finaux sont rares et justifies.
- Les rapports expliquent clairement les trous restants.
- `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test` et
  `npm run build` passent.
- Le commit final ne contient que code, tests, docs, rapports et overrides
  durables non copyrightes.

## Commande de lancement recommandee

```text
/goal Suis entierement le document goals/maximal-semantic-strong-alignment-v4.md. Travaille en autonomie jusqu'a remplir les criteres d'acceptation ou atteindre une condition d'arret documentee.
```

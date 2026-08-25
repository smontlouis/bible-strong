# Canonical Enriched Strong Bible

## Objectif

Faire evoluer la pipeline Strong pour produire une seule Bible canonique enrichie
par version, puis generer plusieurs vues/exports a partir de cette source unique.

Le but n'est pas de maintenir deux Bibles differentes (`reader` et `advanced`),
mais un seul artefact verite contenant toutes les annotations Strong avec leurs
metadonnees:

- placement sur mot visible;
- placement sur phrase visible;
- Strong technique/non rendu;
- Strong vide volontaire;
- Strong masque en mode lecture;
- Strong rejete ou en attente;
- source, confiance, raison et diagnostic.

La vue `reader` doit rester lisible et proche des usages `Sg1910`, `Darby`,
`DarbyR`. La vue `advanced` peut exposer davantage de Strong originaux issus de
WLC/SBLGNT/Macula/STEP, y compris des Strong non rendus ou places sur vide.

## Lire d'abord

- `.agents/skills/bible-to-strong/SKILL.md`
- `.agents/skills/bible-to-strong/references/workflow.md`
- `goals/maximal-semantic-strong-alignment-v4.md`
- `goals/semantic-complete-strong-alignment-v3.md`
- `reports/semantic-complete-strong-v3-report.md`
- `reports/strong-generation-multi-bible-report.md`
- `data/discovery.md`
- `src/generateStrongHybrid.ts`
- `src/readerAlignment.ts`
- `src/semanticStrongV3.ts`
- `src/translationLexicon.ts`
- `src/phraseTranslationLexicon.ts`
- `src/translationProfiles.ts`
- `src/originalSource.ts`
- `src/strongCsv.ts`
- `src/llmReview.ts`
- `viewer/index.html`
- `viewer/strong-viewer.js`
- `viewer/review.html`
- `viewer/reviewer.js`
- `data/curated-strong-overrides.json`

## Principe produit

Construire une seule sortie canonique:

```text
outputs/enriched/<bible>/bible-<bible>-strong-enriched.json
```

Puis generer des vues derivees:

```text
outputs/enriched/<bible>/bible-<bible>-strong-reader.tsv
outputs/enriched/<bible>/bible-<bible>-strong-advanced.tsv
outputs/enriched/<bible>/bible-<bible>-strong-debug.json
```

La sortie canonique doit permettre de repondre clairement:

> Pour chaque Strong attendu du verset, est-il visible en lecture, visible
> seulement en avance, cache, vide, deja represente, non rendu, rejete ou en
> attente, et pourquoi?

## Modes attendus

### 1. Mode reader

Mode par defaut pour l'utilisateur final.

Objectif: lecture fluide et tags Strong utiles.

Regles:

- afficher les Strong sur mots ou phrases francaises fiables;
- s'inspirer prioritairement de `Sg1910`, `Darby`, `DarbyR`;
- utiliser WLC/SBLGNT/Macula/STEP comme confirmation, pas comme densite cible;
- ne pas forcer toutes les particules originales dans le texte francais;
- eviter les mots vides sauf si les references francaises ou le contexte le
  justifient vraiment;
- privilegier les mots semantiques: noms, verbes, adjectifs importants,
  concepts theologiques, personnes, lieux, nombres significatifs;
- accepter les phrases multi-mots quand elles rendent naturellement un Strong;
- masquer les Strong techniques qui nuiraient a la lisibilite.

### 2. Mode advanced

Mode d'etude technique.

Objectif: representation plus exhaustive de l'original.

Regles:

- inclure les annotations `reader`;
- exposer les Strong originaux supplementaires quand ils sont defendables;
- autoriser davantage de placements `empty` ou `technical`;
- conserver les liens vers inventaire original WLC/SBLGNT/Macula/STEP;
- documenter les Strong absents des references francaises mais presents dans
  l'original;
- ne jamais inventer un Strong absent de l'original ou des references du verset.

### 3. Mode debug

Mode pour developpement et controle qualite.

Il doit exposer:

- toutes les annotations;
- toutes les decisions masquees;
- les diagnostics;
- les preuves reference/original;
- les scores;
- les raisons de rejet;
- les cas `pending-human`;
- les decisions appliquees depuis `data/curated-strong-overrides.json`.

## Schema canonique minimal

Definir un schema TypeScript pour une annotation Strong enrichie.

Exemple indicatif:

```ts
type StrongVisibility =
  | "reader"
  | "advanced"
  | "hidden"
  | "pending"
  | "rejected";
type StrongPlacement =
  | "word"
  | "phrase"
  | "empty"
  | "duplicate"
  | "not-rendered"
  | "technical";
type StrongSource =
  | "reference-transfer"
  | "phrase-transfer"
  | "semantic-lexicon"
  | "original-complete"
  | "manual-review"
  | "llm-review"
  | "curated-override";

interface EnrichedStrongAnnotation {
  strong: string;
  visibility: StrongVisibility;
  placement: StrongPlacement;
  source: StrongSource;
  confidence: number;
  reason: string;
  diagnostics: string[];
  wordIndex?: number;
  startWordIndex?: number;
  endWordIndex?: number;
  normalizedWord?: string;
  normalizedPhrase?: string;
  originalLemma?: string;
  originalGloss?: string;
  originalOccurrenceIndex?: number;
  referenceSupport?: Array<"Sg1910" | "Darby" | "DarbyR">;
  profile?: string;
}
```

Adapter le schema aux types existants du repo si une structure equivalente est
deja presente. Ne pas multiplier les formats concurrents.

## Strategie technique

### 1. Construire un ledger enrichi par verset

Pour chaque verset, produire:

- texte cible tokenise;
- Strong deja places par la pipeline hybride;
- inventaire `Sg1910`, `Darby`, `DarbyR`;
- inventaire original WLC/SBLGNT/Macula/STEP;
- correspondances mot/phrase;
- Strong representes en mode reader;
- Strong supplementaires possibles en mode advanced;
- Strong non rendus ou techniques;
- Strong en attente ou rejetes.

Le ledger peut etre sauvegarde par livre si le fichier complet est trop gros:

```text
outputs/enriched/<bible>/ledger/<Book>.json
outputs/enriched/<bible>/ledger/manifest.json
```

### 2. Ne pas confondre inventaire original et densite visible

Macula/WLC/SBLGNT/STEP sont des sources de verification et d'exhaustivite.

Ils ne doivent pas imposer que chaque mot original devienne visible en mode
`reader`.

Decision attendue:

- si le Strong est semantique et rendu par un mot/phrase francais: `reader`;
- si le Strong est semantique mais rendu indirectement ou techniquement:
  `advanced`;
- si le Strong est une particule/morphologie non rendue: `advanced` ou
  `not-rendered`;
- si le Strong est deja porte par un autre mot/phrase du verset:
  `duplicate`;
- si le cas est ambigu: `pending-human`.

### 3. Profils de traduction

Conserver la politique "style 4": hybride calibre par type de Bible.

Les profils doivent influencer la visibilite, pas seulement les diagnostics:

- formelle (`fmar`, `ost`, `nvs78p`): densite reader plus elevee acceptee;
- lisible-formelle (`nbs`, `s21`): densite moyenne, tags visibles utiles;
- dynamique (`bds`, `bfc`, `frc97`, `nfc`): moins de tags visibles, mais les
  tags semantiques importants doivent etre mieux couverts;
- chaque profil peut avoir des seuils distincts pour `reader` vs `advanced`.

### 4. Phrases multi-mots

Le format canonique doit supporter un Strong sur une expression.

Exemples:

- `etre humain`;
- `dans la mesure ou`;
- `se repentir`;
- `prendre pour femme`;
- toute locution francaise qui rend naturellement un Strong unique.

Le viewer doit visualiser clairement une annotation de phrase et permettre de
basculer entre affichage `reader` et `advanced`.

### 5. LLM et agents

Le LLM ne doit pas etre la source finale. Il propose des decisions structurees
pour les cas residuels.

Le prompt doit fournir:

- texte cible tokenise;
- tags actuels;
- references `Sg1910`, `Darby`, `DarbyR`;
- inventaire original;
- profil de traduction;
- mode attendu (`reader`, `advanced`, ou les deux);
- schema JSON obligatoire;
- interdiction d'inventer un Strong absent du verset.

Les decisions LLM doivent passer par un validateur local avant d'entrer dans la
sortie canonique ou dans `data/curated-strong-overrides.json`.

### 6. Export TSV

Garder la compatibilite avec le viewer TSV actuel.

Ajouter ou adapter des commandes:

```sh
npm run generate:strong:enriched -- --bible nbs
npm run export:strong:reader -- --bible nbs
npm run export:strong:advanced -- --bible nbs
```

Les noms exacts peuvent etre ajustes selon les conventions du repo, mais il doit
exister une commande claire pour:

- generer le canonique enrichi;
- exporter la vue reader;
- exporter la vue advanced.

## Viewer attendu

Mettre a jour le viewer pour charger l'artefact enrichi ou les TSV derives.

Fonctionnalites minimales:

- toggle `Reader` / `Advanced` / `Debug`;
- drawer Strong FR existant au clic;
- affichage distinct mot, phrase, vide, technique;
- compteur par chapitre:
  - Strong visibles reader;
  - Strong visibles advanced;
  - Strong vides;
  - Strong non rendus;
  - pending;
- option pour masquer/afficher les Strong advanced;
- ne pas melanger la vue de lecture et la revue humaine.

Le reviewer doit rester separe du viewer.

## Metriques attendues

Ajouter des metriques separees:

- `readerVisibleStrongCount`;
- `advancedStrongCount`;
- `emptyStrongCount`;
- `phraseStrongCount`;
- `technicalStrongCount`;
- `pendingHumanCount`;
- `rejectedCount`;
- `referenceStrongCoverage`;
- `originalRepresentationRate`;
- `semanticMissingCount`;
- `readerTokenCoverage`;
- `advancedTokenCoverage`;
- distribution par livre, AT/NT et profil.

Important: un meilleur `originalRepresentationRate` ne doit pas etre considere
automatiquement meilleur si cela degrade trop la lisibilite du mode `reader`.

## Bibles cibles

Implementer et tester d'abord:

- `nbs` sur `Gen` complet;
- puis `nbs` complete.

Ensuite generaliser:

- `bds`;
- `bfc`;
- `fmar`;
- `frc97`;
- `nfc`;
- `nvs78p`;
- `ost`;
- `s21` si le JSON local existe.

## Tests attendus

Ajouter des tests automatises pour:

- schema enrichi;
- export reader vs advanced;
- Strong sur phrase;
- Strong vide visible seulement en advanced;
- Strong technique masque en reader;
- conservation des references livre/chapitre/verset;
- non-regression sur les exemples de Genese 6;
- validation qu'un Strong absent de l'inventaire du verset est refuse;
- compatibilite viewer/TSV si applicable.

Executer avant de conclure:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

## Rapports attendus

Creer ou mettre a jour:

```text
reports/canonical-enriched-strong-bible-report.md
```

Le rapport doit contenir:

- choix d'architecture;
- schema final;
- commandes;
- exemples concrets reader vs advanced;
- metriques NBS pilote;
- comparaison avec V3;
- limites restantes;
- recommandations pour appliquer aux autres Bibles;
- liste des fichiers generes ignores par Git.

## Contraintes

- Ne jamais committer les textes bibliques complets generes.
- Garder les sorties volumineuses sous `outputs/`.
- Ne pas remplacer aveuglement la pipeline hybride actuelle avant d'avoir un
  pilote valide.
- Ne pas utiliser Macula comme densite visible obligatoire.
- Ne pas appliquer directement des suggestions LLM sans validation locale.
- Ne pas rendre le mode reader illisible pour ameliorer artificiellement les
  metriques d'exhaustivite.

## Criteres d'acceptation

Le goal est reussi si:

- une sortie canonique enrichie existe pour au moins `nbs` pilote;
- la sortie permet de produire une vue `reader` et une vue `advanced`;
- les annotations portent `visibility`, `placement`, `source`, `confidence` et
  `reason`;
- les Strong phrase et empty sont representables;
- le viewer peut basculer entre reader/advanced/debug ou une alternative
  equivalente est documentee;
- les metriques distinguent lisibilite reader et exhaustivite advanced;
- les tests passent;
- le rapport explique clairement pourquoi une seule Bible enrichie est preferee
  a deux Bibles separees;
- les artefacts volumineux/copyrightes restent ignores par Git.

## Commande pour lancer ce goal

```text
/goal Suis entierement le document goals/canonical-enriched-strong-bible.md. Travaille en autonomie jusqu'a remplir les criteres d'acceptation ou atteindre une condition d'arret documentee.
```

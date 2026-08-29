# Semantic Reader Coverage V5

## Objectif

Construire la methode la plus qualitative possible pour generer des Bibles
Strong francaises avec deux niveaux d'usage dans une seule sortie canonique:

- `Reader`: lecture fluide, tags visibles sur les mots ou phrases francaises
  qui rendent clairement un Strong utile;
- `Advanced`: inventaire complet et explicable des Strong attendus du verset,
  y compris les Strong non rendus, techniques, vides ou seulement implicites.

Le probleme a corriger est clair: les sorties actuelles sont trop
conservatrices en `Reader`. Elles preservent bien beaucoup de Strong en
`Advanced`, mais elles manquent des mots semantiques importants comme
`humain`, `Nephilim`, `Seigneur`, `regretter`, `genealogie`, `pervertir`,
`aneantir`, `voute`, etc.

Le but n'est pas d'avoir artificiellement tous les Strong originaux visibles
sur le texte francais. Le but est que chaque Strong attendu soit:

- soit visible en `Reader` sur un mot ou une phrase defendable;
- soit conserve en `Advanced` avec une raison claire;
- soit marque comme deja represente, non rendu, technique, variante textuelle
  ou `pending-human`.

L'objectif produit est que l'utilisateur n'ait pas a verifier des milliers de
cas. Tout ce qui peut etre resolu par preuves locales, references, lexique,
alignement ou LLM valide doit etre resolu automatiquement.

## Bibles cibles

Priorite:

1. `nbs`, car elle sert de pilote qualite.
2. Puis `bds`, `bfc`, `fmar`, `frc97`, `nfc`, `nvs78p`, `ost`.
3. Ajouter `s21` seulement si `data/bibles/bible-s21.json` existe localement.

Le travail doit etre generique et reutilisable pour n'importe quelle Bible FR
presente sous `data/bibles/`.

## Lire d'abord

- `.agents/skills/bible-to-strong/SKILL.md`
- `.agents/skills/bible-to-strong/references/workflow.md`
- `goals/canonical-enriched-strong-bible.md`
- `goals/semantic-refill-nbs-reader.md`
- `goals/maximal-semantic-strong-alignment-v4.md`
- `reports/canonical-enriched-strong-bible-report.md`
- `reports/semantic-complete-strong-v3-report.md`
- `reports/strong-generation-multi-bible-report.md`
- `src/enrichedStrongBible.ts`
- `src/readerAlignment.ts`
- `src/semanticStrongV3.ts`
- `src/translationLexicon.ts`
- `src/phraseTranslationLexicon.ts`
- `src/llmReview.ts`
- `src/originalSource.ts`
- `src/strongCsv.ts`
- `src/curatedStrongOverrides.ts`
- `data/curated-strong-overrides.json`
- `data/discovery.md`

## Sources autorisees

Utiliser en priorite:

- `Sg1910`, `Darby`, `DarbyR` Strong comme references locales;
- WLC/SBLGNT via Clear.Bible Alignments;
- STEP Bible data si disponible localement, notamment `TAHOT` et `TAGNT`;
- Macula Hebrew / Macula Greek si utile pour morphologie et lemmes;
- dictionnaire Strong local FR si disponible;
- lexiques appris et overrides existants;
- internet pour telecharger ou verifier des datasets open source;
- `AI_GATEWAY_KEY` via Vercel AI Gateway pour les cas difficiles.

Ne jamais committer les textes bibliques generes complets ni les gros artefacts.

## Principe fondamental

La Bible generee doit etre unique, mais chaque annotation Strong doit porter des
metadonnees suffisantes pour piloter l'affichage.

Exemple conceptuel:

```json
{
  "strong": "H7549",
  "target": "phrase",
  "startWordIndex": 24,
  "endWordIndex": 25,
  "normalizedPhrase": ["voute", "celeste"],
  "readerVisible": true,
  "advancedVisible": true,
  "status": "visible-phrase",
  "confidence": 0.94,
  "source": "semantic-refill",
  "evidence": [
    "present-in-original",
    "supported-by-references",
    "semantic-lexicon-match"
  ]
}
```

Le mode `Reader` masque les annotations non utiles a la lecture. Le mode
`Advanced` affiche tout ce qui est necessaire pour l'etude.

## Workflow attendu

### 1. Construire un ledger Strong par verset

Pour chaque verset cible, produire un ledger qui repond:

> Quels Strong etaient attendus dans ce verset, ou sont-ils passes, et pourquoi?

Le ledger doit contenir:

- inventaire original WLC/SBLGNT et/ou STEP;
- inventaire reference `Sg1910`, `Darby`, `DarbyR`;
- inventaire actuellement place dans la Bible cible;
- Strong visibles en `Reader`;
- Strong seulement en `Advanced`;
- Strong manquants ou non representes;
- statut final par Strong.

Statuts attendus:

- `visible-word`;
- `visible-phrase`;
- `empty`;
- `technical`;
- `duplicate-represented`;
- `not-rendered`;
- `wrong-source-or-variant`;
- `pending-human`;
- `rejected-candidate`.

Sortie attendue:

```text
outputs/semantic-reader-v5/<bible>/<scope>/strong-ledger.json
```

Si le fichier est trop gros, utiliser un manifest et un fichier par livre.

### 2. Classer les trous par importance

Ne pas traiter tous les trous de la meme maniere.

Priorite haute:

- noms propres;
- noms communs importants;
- verbes;
- adjectifs/adverbes porteurs de sens;
- concepts theologiques;
- personnes, lieux, nombres significatifs;
- expressions francaises qui rendent un Strong unique.

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

Le profil de traduction doit influencer les seuils:

- `formal`: `fmar`, `ost`, `nvs78p`, plus dense;
- `balanced`: `nbs`, `s21`, densite moyenne et lisible;
- `dynamic`: `bds`, `bfc`, `frc97`, `nfc`, moins dense mais meilleur choix
  semantique.

### 3. Creer une cascade de resolution avant LLM

Avant d'appeler le LLM, tenter automatiquement:

1. match exact ou normalise;
2. match lemme/stem robuste;
3. transfert depuis `Sg1910`, `Darby`, `DarbyR` dans le meme verset;
4. match par lexique Strong FR;
5. match par gloss original/STEP/Macula;
6. equivalence semantique controlee par Strong;
7. detection de phrase multi-mots;
8. detection de Strong deja represente ailleurs;
9. decision `empty`, `technical` ou `not-rendered` pour les particules et
   elements morphologiques.

Cette cascade doit apprendre des familles generiques, pas seulement patcher un
verset.

Familles initiales a couvrir explicitement:

- `H0120`: homme, humain, etre humain, personne;
- `H5162`: repentir, se repentir, regretter;
- `H7843`: corrompre, pervertir, detruire, aneantir;
- `H5303`: geant, Nephilim;
- `H8435`: generation, posterite, genealogie, descendance;
- `H3068`: Eternel, Seigneur, Yahweh selon contexte;
- `H7549`: etendue, firmament, voute;
- `H8064`: ciel, cieux, celeste;
- `H8317` / `H8318`: grouiller, foisonner, pulluler, petites betes selon
  contexte.

Ajouter de nouvelles familles seulement si elles sont prouvees par references,
original, lexique ou validation LLM locale.

### 4. Gerer les phrases comme citoyen de premiere classe

Le systeme doit pouvoir attacher un Strong a une phrase contigue.

Exemples:

- `Qu'il y ait` pour un usage de `H1961` si la locution complete est plus
  juste que le seul mot `ait`;
- `voute celeste` pour `H7549` + `H8064`;
- `etre humain` pour `H0120`;
- `dans la mesure ou` pour un Strong rendu par une locution;
- une locution verbale francaise pour un verbe hebreu/grec.

Chaque phrase doit etre validee:

- `startWordIndex`;
- `endWordIndex`;
- tokens contigus;
- `normalizedPhrase` conforme au texte;
- Strong present dans l'inventaire du verset;
- preuve;
- confiance.

### 5. Utiliser le LLM de maniere ciblee

Le LLM ne doit pas remplacer la pipeline. Il doit arbitrer les cas ou la
cascade deterministe ne suffit pas.

Envoyer au LLM par chapitre ou par petit bloc coherent:

- texte cible tokenise avec index;
- tags actuels;
- ledger des Strong attendus;
- references `Sg1910`, `Darby`, `DarbyR` avec Strong;
- inventaire original;
- candidats deterministes;
- profil de traduction;
- schema JSON strict.

Le LLM doit retourner uniquement des decisions structurees:

- `word`;
- `phrase`;
- `empty`;
- `technical`;
- `duplicate-represented`;
- `not-rendered`;
- `pending-human`;
- `reject`.

Contraintes:

- ne jamais inventer un Strong absent du verset;
- ne jamais forcer une particule faible en `Reader`;
- ne jamais appliquer sans validation locale;
- expliquer chaque decision en une raison courte et verifiable.

Modele par defaut:

```text
deepseek/deepseek-v4-flash
```

Utiliser un modele plus fort seulement pour les residus difficiles et documenter
le cout.

### 6. Valider localement toutes les decisions

Toute decision deterministe, LLM ou agent doit passer par un validateur local.

Refuser automatiquement:

- Strong absent de l'inventaire original ou reference du verset;
- index invalide;
- phrase non contigue;
- phrase dont les tokens ne correspondent pas au texte;
- cible contradictoire avec toutes les references;
- promotion d'une particule technique sans preuve forte;
- doublon non justifie;
- decision qui degrade clairement une evaluation gold;
- confiance insuffisante pour le profil de traduction.

Accepter automatiquement:

- Strong present dans original/reference;
- cible francaise visible compatible;
- preuve lexicale ou semantique suffisante;
- confiance au-dessus du seuil du profil;
- pas de conflit avec un tag plus fiable.

Les vrais residus vont dans `pending-human`, mais ils doivent rester rares.

### 7. Persister les apprentissages

Les decisions valides doivent etre reutilisables.

Utiliser ou creer:

- `data/curated-strong-overrides.json` pour les decisions localisees;
- un lexique semantic durable pour les formes recurrentes;
- un fichier de familles semantiques par Strong si necessaire.

Ne pas multiplier les overrides ponctuels quand une regle ou un lexique
generique est possible.

### 8. Pilote NBS obligatoire

Avant de generaliser, faire un pilote profond sur NBS:

- Genese 1;
- Genese 6;
- quelques chapitres difficiles identifies par le ledger.

Cas de regression obligatoires:

- Gen.1.6: `H7549` doit etre visible sur `voute` sauf justification contraire;
- Gen.1.6: decision explicite pour `H1961` mot vs phrase vs empty;
- Gen.1.20: `H7549/H8064` doivent etre traites autour de `voute celeste`;
- Gen.1.20: decision explicite pour `H8317/H8318`;
- Gen.6.2: `humains` / `etre humain` ne doit pas manquer sans raison;
- Gen.6.4: `Nephilim` ne doit pas manquer sans raison;
- Gen.6.6-7: `regretta` / `je regrette` doit etre etudie pour `H5162`;
- Gen.6.9: `genealogie` doit etre etudie pour `H8435`;
- Gen.6.11-12: `pervertie` doit etre etudie pour le Strong pertinent;
- Gen.6.13: `aneantir` doit etre etudie pour le Strong pertinent.

### 9. Generaliser Bible entiere

Quand le pilote NBS est valide:

1. lancer NBS complete;
2. mesurer avant/apres;
3. analyser les pires residus;
4. appliquer une seconde passe si necessaire;
5. seulement ensuite generaliser aux autres Bibles.

Pour chaque Bible, produire:

- ledger;
- decisions;
- pending-human;
- rapport;
- sortie canonique enrichie;
- export Reader si necessaire;
- export Advanced si necessaire.

### 10. Revue humaine minimale

Si une revue humaine reste necessaire, elle doit etre claire:

- seulement les `pending-human`;
- affichage du verset complet;
- affichage des references;
- affichage du Strong et du lexique FR;
- correction possible sur mot ou phrase;
- bouton enregistrer qui persiste au bon endroit;
- pas d'export manuel confus.

Le but est que l'utilisateur valide quelques vrais cas limites, pas qu'il
devienne l'aligner principal.

## Commandes attendues

Ajouter ou stabiliser des commandes du type:

```sh
npm run semantic-reader:v5 -- --bible nbs --only Gen --pilot
npm run semantic-reader:v5 -- --bible nbs --all
npm run semantic-reader:v5 -- --bible bds --all
```

Et si besoin:

```sh
npm run generate:strong:enriched -- --bible nbs
npm run export:strong:reader -- --bible nbs
npm run export:strong:advanced -- --bible nbs
```

Les noms exacts peuvent etre adaptes au code existant, mais le rapport doit
documenter les commandes finales.

## Sorties attendues

Pour le pilote:

```text
outputs/semantic-reader-v5/nbs/Gen/strong-ledger.json
outputs/semantic-reader-v5/nbs/Gen/candidates.json
outputs/semantic-reader-v5/nbs/Gen/decisions.json
outputs/semantic-reader-v5/nbs/Gen/pending-human.json
outputs/semantic-reader-v5/nbs/Gen/rejected.json
```

Pour la Bible complete:

```text
outputs/semantic-reader-v5/nbs/manifest.json
outputs/semantic-reader-v5/nbs/books/<Book>/strong-ledger.json
outputs/semantic-reader-v5/nbs/books/<Book>/decisions.json
outputs/enriched/nbs/
```

Rapport:

```text
reports/semantic-reader-coverage-v5-report.md
```

## Metriques attendues

Comparer avant/apres:

- `readerVisibleStrongCount`;
- `advancedStrongCount`;
- `emptyStrongCount`;
- `technicalStrongCount`;
- `phraseStrongCount`;
- `semanticMissingCount`;
- `readerTokenCoverage`;
- `originalRepresentationRate`;
- `referenceStrongCoverage`;
- nombre de Strong semantiques promus depuis `Advanced`;
- nombre de decisions `empty/not-rendered/technical` justifiees;
- nombre de `pending-human`;
- precision attendue sur evaluation gold;
- exemples corriges;
- exemples volontairement non corriges avec raison.

Une augmentation de couverture n'est positive que si elle ameliore les tags
semantiques defendables. Ne pas optimiser les metriques en rendant visibles des
particules faibles.

## Tests attendus

Ajouter ou mettre a jour des tests pour:

- ledger par verset;
- classification high/medium/low/technical;
- detection de phrase contigue;
- validation d'index word/phrase;
- rejet de Strong absent du verset;
- rejet de particules faibles non rendues;
- application d'overrides `word`;
- application d'overrides `phrase`;
- conservation des annotations `Advanced`;
- affichage `Reader` sans regression;
- cas NBS Gen.1.6;
- cas NBS Gen.1.20;
- cas NBS Gen.6 cites dans ce goal.

## Contraintes

- Ne pas supprimer la pipeline canonique existante.
- Ne pas produire deux Bibles separees pour `Reader` et `Advanced`; produire
  une sortie canonique avec deux modes.
- Ne pas committer les sorties completes sous `outputs/`.
- Ne pas appliquer aveuglement les suggestions LLM.
- Ne pas demander a l'utilisateur de verifier des milliers de cas.
- Ne pas se limiter a Genese 6 ou a quelques patches.
- Documenter les limites si une Bible dynamique comme `bds` ne peut pas avoir
  la meme densite qu'une Bible formelle.

## Criteres d'acceptation

Le goal est reussi si:

- NBS pilote corrige les trous semantiques cites ou documente exactement
  pourquoi ils ne doivent pas etre visibles;
- la methode est generique, pas une suite de patches;
- la NBS complete peut etre regeneree avec le nouveau comportement;
- les decisions sont tracables dans un ledger;
- chaque Strong attendu a un statut explicable;
- `Reader` est plus complet sur les mots semantiques importants;
- `Advanced` conserve les Strong non visibles avec raison;
- le nombre de `pending-human` reste faible;
- les metriques avant/apres sont documentees;
- les tests couvrent les cas critiques;
- les checks passent:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Condition d'arret acceptable

Si la solution complete exige plus de temps, de calcul ou de budget:

- terminer au minimum un pilote NBS prouve sur Genese 1 et Genese 6;
- produire le ledger et les decisions;
- montrer les corrections visibles dans le viewer;
- estimer le cout/temps pour la Bible complete;
- documenter les commandes exactes pour reprendre.

## Commande pour lancer ce goal

```text
/goal Suis entierement le document goals/semantic-reader-coverage-v5.md. Travaille en autonomie jusqu'a remplir les criteres d'acceptation ou atteindre une condition d'arret documentee.
```

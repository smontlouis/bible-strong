# Semantic Refill NBS Reader

## Objectif

Construire une passe production `semantic-refill` pour la NBS enrichie.

La pipeline canonique actuelle a resolu le stockage et l'affichage:

- une Bible canonique enrichie;
- une vue `Reader`;
- une vue `Advanced`;
- une vue `Debug`.

Mais elle laisse encore trop de trous semantiques en `Reader`: beaucoup de
Strong attendus sont bien presents en `Advanced` comme `empty` ou `technical`,
alors que le francais NBS les rend clairement par un mot moderne, un synonyme ou
une locution.

Le but de ce goal est de transformer ces Strong `Advanced empty` confirmes en
tags `Reader` propres sur mot ou phrase, sans rendre le texte illisible et sans
promouvoir les particules techniques faibles.

## Lire d'abord

- `.agents/skills/bible-to-strong/SKILL.md`
- `.agents/skills/bible-to-strong/references/workflow.md`
- `goals/canonical-enriched-strong-bible.md`
- `reports/canonical-enriched-strong-bible-report.md`
- `reports/semantic-complete-strong-v3-report.md`
- `reports/strong-generation-multi-bible-report.md`
- `src/enrichedStrongBible.ts`
- `src/readerAlignment.ts`
- `src/translationLexicon.ts`
- `src/phraseTranslationLexicon.ts`
- `src/semanticStrongV3.ts`
- `src/llmReview.ts`
- `src/originalSource.ts`
- `src/strongCsv.ts`
- `data/curated-strong-overrides.json`
- `data/discovery.md`

## Sources attendues

Entrees principales:

```text
outputs/enriched/nbs/bible-nbs-strong-enriched.json
outputs/enriched/nbs/verses/*.json
data/strongs/Sg1910.csv
data/strongs/Darby.csv
data/strongs/DarbyR.csv
data/external/Alignments/data/sources/WLC.tsv
data/external/Alignments/data/sources/SBLGNT.tsv
data/dictionaries/strong_lexicon.sqlite si disponible
data/curated-strong-overrides.json
```

Sources optionnelles utiles:

```text
data/external/stepbible/amalgamated/TAHOT*.txt
data/external/stepbible/amalgamated/TAGNT*.txt
data/external/macula-*
```

Ne pas bloquer le goal si STEP/Macula ne sont pas necessaires pour le pilote.

## Scope

Priorite:

1. NBS Genese complete.
2. Si les metriques sont bonnes, NBS complete.

Le travail doit rester generique: ne pas se contenter de patcher uniquement les
versets cites ci-dessous.

## Cas a resoudre explicitement

### Genese 1.6

NBS:

```text
Dieu dit : Qu'il y ait une voute au milieu des eaux pour separer les eaux des eaux !
```

Problemes:

- `H7549` est en `Advanced empty`, mais devrait aller sur `voute`;
- `H1961` est pose seulement sur `ait`; il faut etudier une expansion phrase
  `Qu'il y ait` si elle est validee par le schema reader.

### Genese 1.20

NBS:

```text
Dieu dit : Que les eaux grouillent de petites betes, d'etres vivants, et que des oiseaux volent au-dessus de la terre, face a la voute celeste !
```

Problemes:

- `H8317` / `H8318` devraient probablement etre portes par `grouillent` /
  `petites betes` ou une phrase equivalente;
- `H7549` / `H8064` devraient probablement etre portes par `voute celeste`.

Ces cas doivent servir de tests de regression, pas de seule cible.

## Principe produit

On ne cherche pas a tout rendre visible.

On cherche a corriger les Strong qui remplissent ces conditions:

- actuellement `visibility: advanced`;
- `placement: empty` ou `technical`;
- Strong present dans l'original du verset;
- Strong confirme par les references francaises, idealement
  `Sg1910 + Darby + DarbyR`;
- le texte NBS contient un mot ou une phrase francaise qui rend clairement ce
  Strong.

Les particules faibles, prepositions techniques, articles, marqueurs objets et
Strong purement morphologiques ne doivent pas etre promus en `Reader` sans
preuve forte.

## Methode attendue

### 1. Audit des trous semantic-refill

Ajouter une commande du type:

```sh
npm run strong:semantic-refill -- --bible nbs --only Gen --audit
```

ou une commande equivalente claire.

Elle doit produire:

```text
outputs/semantic-refill/nbs/Gen/semantic-refill-candidates.json
```

Chaque item doit contenir:

- `bible`;
- `ref`;
- texte NBS tokenise avec index;
- annotation advanced actuelle;
- Strong;
- placement actuel;
- reference support;
- inventaire original;
- mots/phrases des references Strong;
- candidats deterministes;
- priorite;
- raison pour laquelle le cas est eligible ou non.

Priorites:

- `semantic-high`: nom, verbe, adjectif/adverbe important, concept, nom propre,
  lieu, nombre significatif;
- `semantic-medium`: relation utile ou locution semantique;
- `function-low`: preposition, conjonction, pronom ou particule faible;
- `technical-skip`: article, marqueur objet, morphologie non rendue, doublon
  deja represente.

### 2. Generation de candidats mot/phrase

Pour chaque Strong eligible, generer des candidats dans le verset NBS.

Sources autorisees:

- mots et phrases taggues dans `Sg1910`, `Darby`, `DarbyR`;
- lexique Strong/STEP FR si disponible;
- glosses WLC/SBLGNT;
- formes deja reussies dans la NBS;
- n-grams non taggues du verset cible;
- expressions autour d'un mot deja taggue faiblement;
- LLM cible via `AI_GATEWAY_KEY` pour les cas difficiles.

Les candidats peuvent etre:

- `word`;
- `phrase`;
- `empty`;
- `technical`;
- `duplicate`;
- `reject`;
- `pending-human`.

### 3. Scoring deterministe

Chaque candidat doit recevoir un score explicable.

Le score doit tenir compte de:

- Strong present dans l'original du verset;
- Strong present dans les references;
- nombre de references qui confirment le Strong;
- proximite positionnelle;
- correspondance lexicale exacte/stem/gloss;
- correspondance semantique via lexique;
- recurrence deja observee;
- cible deja non tagguee ou faiblement tagguee;
- compatibilite avec le profil `nbs`;
- risque de promouvoir une particule technique.

Exemple attendu:

```json
{
  "strong": "H7549",
  "target": "word",
  "wordIndex": 6,
  "normalizedWord": "voute",
  "score": 0.94,
  "evidence": [
    "H7549 present in original",
    "H7549 supported by Sg1910+Darby+DarbyR",
    "references use etendue",
    "lexicon/gloss expanse/firmament",
    "target word voute is untagged and position-compatible"
  ]
}
```

### 4. Lexique durable appris

Ne pas ajouter seulement des overrides ponctuels.

Quand une association est recurrente et sure, creer ou enrichir un lexique
durable par Strong, par exemple:

```json
{
  "strong": "H7549",
  "forms": ["voute", "firmament", "etendue"],
  "source": "semantic-refill",
  "evidence": ["reference-transfer", "original-gloss", "validated-occurrences"],
  "confidence": 0.94
}
```

Le chemin exact peut etre choisi selon l'architecture existante, mais le resultat
doit etre reutilisable par les prochaines generations, pas seulement par une
revue manuelle de Genese 1.

### 5. Phrase expansion

Ajouter une vraie gestion des phrases naturelles.

Exemples:

- `ait` peut devenir `Qu'il y ait` si la phrase rend mieux `H1961`;
- `voute celeste` peut porter `H7549 + H8064`;
- `petites betes` peut porter un Strong qui n'est pas rendu par un seul mot
  literal dans les references.

La phrase doit etre contigue et validee:

- `startWordIndex`;
- `endWordIndex`;
- `normalizedPhrase`;
- `strong`;
- source;
- confidence;
- reason.

### 6. LLM cible

Le LLM doit etre utilise comme arbitre cible, pas comme generateur global.

Envoyer seulement les cas eligibles ou ambigus, avec:

- verset NBS tokenise;
- references `Sg1910`, `Darby`, `DarbyR` avec Strong;
- inventaire original;
- annotation advanced actuelle;
- candidats deterministes;
- profil de traduction;
- schema JSON strict.

Le LLM doit choisir:

- `word`;
- `phrase`;
- `empty`;
- `technical`;
- `duplicate`;
- `reject`;
- `pending-human`.

Contraintes LLM:

- ne jamais inventer un Strong absent du verset;
- ne jamais promouvoir une particule faible sans preuve;
- repondre uniquement en JSON valide;
- fournir une raison courte et verifiable.

Modele par defaut si utilise:

```text
deepseek/deepseek-v4-flash
```

Utiliser un modele plus fort seulement pour les residus difficiles et documenter
le cout.

### 7. Validation locale stricte

Toute decision deterministe ou LLM doit passer par un validateur local.

Refuser:

- Strong absent de l'inventaire original/reference du verset;
- index invalide;
- phrase non contigue;
- phrase dont les tokens ne correspondent pas au texte NBS;
- cible deja saturee;
- conflit avec un tag reader plus fiable;
- promotion de particule faible sans preuve forte;
- decision avec confiance insuffisante.

### 8. Application et regeneration

Les decisions validees doivent etre persistantes:

- soit dans `data/curated-strong-overrides.json`;
- soit dans un lexique semantic-refill durable;
- soit dans une structure equivalente documentee.

Ensuite regenerer:

```sh
npm run generate:strong:enriched -- --bible nbs --only Gen --output-dir outputs/enriched/nbs-gen
```

Puis, si valide:

```sh
npm run generate:strong:enriched -- --bible nbs
```

## Livrables

- commande npm claire, par exemple:

```sh
npm run strong:semantic-refill -- --bible nbs --only Gen
```

- audit JSON:

```text
outputs/semantic-refill/nbs/Gen/semantic-refill-candidates.json
```

- decisions validees:

```text
outputs/semantic-refill/nbs/Gen/semantic-refill-decisions.json
```

- fichier de decisions rejetees/pending:

```text
outputs/semantic-refill/nbs/Gen/semantic-refill-pending.json
outputs/semantic-refill/nbs/Gen/semantic-refill-rejected.json
```

- NBS enrichie regeneree;
- metriques avant/apres;
- rapport:

```text
reports/semantic-refill-nbs-report.md
```

## Metriques attendues

Comparer avant/apres:

- nombre de `advanced empty` semantiques;
- nombre de `advanced technical` promus/refuses;
- `semantic-refill accepted`;
- `semantic-refill rejected`;
- `pending-human`;
- `readerVisibleStrongCount`;
- `readerTokenCoverage`;
- `phraseStrongCount`;
- `referenceStrongCoverage`;
- exemples corriges;
- exemples volontairement non corriges avec raison.

Important: une hausse de densite reader n'est bonne que si elle ajoute des mots
ou phrases semantiques defendables.

## Tests attendus

Ajouter des tests automatises pour:

- `Gen.1.6`: `H7549 -> voute`;
- `Gen.1.6`: expansion phrase possible autour de `Qu'il y ait` pour `H1961`
  si la decision est retenue;
- `Gen.1.20`: `H7549/H8064 -> voute celeste`;
- `Gen.1.20`: traitement defendable de `H8317/H8318`;
- rejet des particules faibles comme `H0853`, `H0996` quand elles ne sont pas
  clairement rendues;
- validation qu'un Strong absent de l'inventaire du verset est refuse;
- validation des index phrase;
- regeneration reader/advanced/debug sans regression du schema canonique.

## Contraintes

- Ne jamais committer les sorties completes sous `outputs/`.
- Ne pas faire seulement du patch manuel verse par verse.
- Ne pas promouvoir les particules techniques pour ameliorer artificiellement
  les metriques.
- Ne pas accepter une suggestion LLM sans validation locale.
- Ne pas casser les modes `Reader`, `Advanced`, `Debug`.
- Ne pas remplacer la pipeline canonique; la passe `semantic-refill` doit la
  completer.

## Criteres d'acceptation

Le goal est reussi si:

- Genese NBS montre une amelioration visible sur les trous semantiques;
- `Gen.1.6` est resolu ou documente precisement:
  - `H7549` sur `voute`;
  - decision claire pour `H1961` phrase vs mot vs empty;
- `Gen.1.20` est resolu ou documente precisement:
  - `H7549/H8064` sur `voute celeste` ou justification contraire;
  - decision claire pour `H8317/H8318`;
- les decisions ne sont pas seulement ad hoc mais reutilisables;
- la NBS complete peut etre regeneree;
- les metriques montrent moins de `advanced-empty` semantiques;
- les decisions sont tracables et reexecutables;
- le rapport explique la methode et ses limites;
- les artefacts volumineux restent ignores par Git;
- les checks passent:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Commande pour lancer ce goal

```text
/goal Suis entierement le document goals/semantic-refill-nbs-reader.md. Travaille en autonomie jusqu'a remplir les criteres d'acceptation ou atteindre une condition d'arret documentee.
```

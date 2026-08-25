# Semantic Complete Strong Alignment V3

## Objectif

Construire une V3 de la pipeline Strong qui maximise la couverture des mots
semantiques importants dans les Bibles francaises, en partant de l'inventaire
Strong attendu du verset au lieu de seulement tagger les mots faciles.

Le probleme constate en V2 est clair: la pipeline pose beaucoup de tags fiables,
mais laisse des trous sur des mots essentiels quand la traduction francaise est
synonymique ou plus moderne.

Exemples observes en NBS Genese 6:

- `humains` / `etre humain` devrait souvent porter `H0120`;
- `Nephilim` devrait porter `H5303`;
- `regretta` / `regrette` devrait porter `H5162`;
- `genealogie` devrait porter `H8435`;
- `pervertie` / `pervertis` devrait porter `H7843`;
- `aneantir` devrait porter `H7843`;
- `Seigneur` doit porter `H3068` quand l'original a YHWH, pas recevoir un Strong
  voisin par erreur positionnelle.

Le but de cette V3 est d'obtenir une sortie beaucoup plus complete et
editorialement defendable, meme si cela implique des passes LLM ou multi-agent
controlees.

## Bibles cibles

Priorite pilote:

- `nbs`, livre `Gen` complet.

Puis, si le pilote est valide:

- `nbs` complete;
- `bds`;
- `bfc`;
- `fmar`;
- `frc97`;
- `nfc`;
- `nvs78p`;
- `ost`.

Ajouter `s21` seulement si `data/bibles/bible-s21.json` existe localement et si
les sources permettent de la traiter.

## Lire d'abord

- `.agents/skills/bible-to-strong/SKILL.md`
- `.agents/skills/bible-to-strong/references/workflow.md`
- `goals/phrase-aware-strong-alignment-v2.md`
- `goals/phrase-aware-production-second-pass.md`
- `reports/phrase-aware-strong-v2-report.md`
- `reports/hybrid-strong-report.md`
- `reports/hybrid-gold-evaluation-report.md`
- `data/discovery.md`
- `src/generateStrongHybrid.ts`
- `src/readerAlignment.ts`
- `src/translationLexicon.ts`
- `src/phraseTranslationLexicon.ts`
- `src/curatedStrongOverrides.ts`
- `src/llmReview.ts`
- `src/originalSource.ts`
- `src/strongCsv.ts`
- `viewer/reviewer.js`
- `data/curated-strong-overrides.json`

## Principe technique

Changer de logique produit:

- V2 actuelle: "tagger ce qui est fiable facilement, eviter les erreurs".
- V3 attendue: "pour chaque verset, partir de l'inventaire Strong attendu et
  trouver le meilleur porteur francais pour chaque Strong semantique important".

La V3 doit etre `inventory-first`:

1. Construire l'inventaire Strong attendu du verset depuis WLC/SBLGNT et les
   references locales `Sg1910`, `Darby`, `DarbyR`.
2. Comparer cet inventaire avec les Strong deja places dans la Bible cible.
3. Identifier les Strong manquants, surtout les Strong semantiques.
4. Trouver une cible francaise:
   - `word`;
   - `phrase`;
   - `empty`;
   - `reject-duplicate`;
   - `reject-not-rendered`;
   - `pending-human`.
5. Valider automatiquement chaque decision.
6. Appliquer durablement seulement les decisions validees.
7. Regenerer et mesurer.

## Taxonomie des Strong

Classer les Strong manquants avant de les traiter.

### Semantiques prioritaires

Doivent etre places sur mot ou phrase visible quand une cible francaise existe:

- noms propres;
- noms communs importants;
- verbes;
- adjectifs/adverbes semantiques;
- concepts theologiques;
- actions fortes;
- lieux, personnes, nombres significatifs.

### Fonctionnels / relationnels

Peuvent etre places, mais seulement si le francais les rend clairement:

- prepositions;
- conjonctions;
- pronoms;
- particules relationnelles.

### Original non rendu / technique

Peuvent devenir `empty` ou `reject-not-rendered` selon le cas:

- articles hebreux;
- marqueur objet `H0853`;
- particules non traduites;
- suffixes pronominaux seulement si deja rendu ailleurs;
- variantes morphologiques STEP non directement visibles.

## Architecture attendue

### 1. Generateur de trous semantiques

Ajouter une commande du type:

```sh
npm run strong:v3:missing -- --bible nbs --only Gen
```

Elle doit produire:

```text
outputs/semantic-v3/nbs/Gen/missing-semantic-strong.json
```

Chaque item doit contenir:

- `bible`;
- `ref`;
- `book`;
- `chapter`;
- `verse`;
- texte cible tokenise avec index;
- Strong attendu;
- lemme original;
- gloss original;
- occurrence originale;
- references `Sg1910`, `Darby`, `DarbyR`;
- tags deja places;
- raison du manque;
- priorite: `semantic-high`, `semantic-medium`, `function`, `not-rendered-candidate`;
- proposition deterministe si disponible.

### 2. Alignement deterministe enrichi

Corriger les faiblesses systemiques avant de payer du LLM:

- ajouter des equivalences semantiques FR controlees;
- utiliser le lexique Strong FR/STEP si disponible;
- ajouter des families synonymiques apprises:
  - homme -> humain / etre humain;
  - se repentir -> regretter;
  - corrompre -> pervertir;
  - detruire -> aneantir;
  - geants -> Nephilim;
  - generations/posterite -> genealogie;
- corriger les faux positifs `window` trop permissifs;
- interdire les matches de stem trop courts;
- privilegier les Strong confirms par original + references.

La correction ne doit pas etre seulement une liste ad hoc pour Genese 6. Elle
doit generaliser, mais Genese 6 doit rester un test de regression.

### 3. Orchestrateur de paquets

Ajouter une commande du type:

```sh
npm run strong:v3:plan -- --bible nbs --books Gen --chunk-size chapter
```

Elle doit produire des paquets autonomes sous:

```text
outputs/semantic-v3/nbs/Gen/work-items/
```

Chaque paquet doit etre ferme et suffisant pour un agent ou un LLM:

- chapitre cible;
- sortie V2 actuelle;
- inventaire original;
- references Strong locales;
- Strong manquants prioritises;
- consignes de sortie JSON;
- exemples de bonnes decisions.

### 4. Agents / LLM comme proposeurs, pas comme source finale

Les agents ou LLM peuvent travailler en parallele, mais ils ne doivent pas
modifier directement la Bible finale.

Chaque agent doit produire seulement un fichier de decisions:

```json
{
  "bible": "nbs",
  "book": "Gen",
  "scope": "Gen.6",
  "decisions": [
    {
      "ref": "Gen.6.6",
      "strong": ["H5162"],
      "target": "word",
      "wordIndex": 2,
      "normalized": "regretta",
      "confidence": 0.94,
      "decision": "accept-word",
      "reason": "H5162 est rendu par repentir dans les references; NBS traduit par regretter."
    }
  ]
}
```

Cibles autorisees:

- `accept-word`;
- `accept-phrase`;
- `accept-empty`;
- `reject-duplicate`;
- `reject-not-rendered`;
- `reject-wrong`;
- `pending-human`.

Les decisions doivent conserver:

- preuve originale;
- preuve reference;
- raison semantique;
- confiance;
- cible exacte.

### 5. Validateur central

Ajouter une commande du type:

```sh
npm run strong:v3:validate -- --bible nbs --input outputs/semantic-v3/nbs/Gen/decisions
```

Le validateur doit refuser automatiquement:

- Strong absent de l'inventaire du verset;
- index de mot inexistant;
- phrase non contigue;
- `normalized` qui ne correspond pas au texte cible;
- doublon injustifie;
- cible fonctionnelle faible alors qu'un meilleur mot semantique existe;
- decision sans raison;
- confiance trop basse pour auto-application;
- collision avec un override humain existant sauf si explicitement compatible.

Il doit produire:

```text
outputs/semantic-v3/nbs/Gen/validated-decisions.json
outputs/semantic-v3/nbs/Gen/rejected-decisions.json
outputs/semantic-v3/nbs/Gen/pending-human.json
```

### 6. Application durable

Appliquer uniquement les decisions validees vers:

```text
data/curated-strong-overrides.json
```

Ne jamais committer les sorties completes sous `outputs/`.

La V3 doit pouvoir appliquer:

- `word`;
- `phrase`;
- `empty`.

Les `reject-*` doivent etre conserves dans les rapports/artefacts de decisions,
mais ne doivent pas supprimer silencieusement un Strong.

### 7. Regeneration et comparaison

Apres application:

```sh
npm run generate:strong:hybrid -- --bible nbs --only Gen
```

Puis, si pilote valide:

```sh
npm run generate:strong:hybrid -- --bible nbs
```

Comparer V2 vs V3:

- token coverage;
- visible Strong rate;
- empty Strong rate;
- phrase count;
- semantic missing count;
- original representation rate;
- hard verse count;
- exemples qualitatifs.

## Multi-agent recommande

Ne pas lancer 20 agents qui modifient le repo.

Pattern recommande:

- un orchestrateur cree les paquets;
- 2 a 5 agents travaillent en parallele;
- chaque agent traite un livre court ou un bloc de chapitres;
- chaque agent ecrit uniquement un JSON de decisions;
- le validateur central decide ce qui est applicable.

Decoupage:

- pilote: `nbs` `Gen`;
- livres longs: blocs de 10 a 25 chapitres;
- Psaumes: blocs de 25 a 50 psaumes;
- livres courts: un livre par agent.

Si les outils multi-agent sont disponibles, les utiliser pour proposer des
decisions en parallele. Sinon, utiliser le LLM via AI Gateway par chapitre ou par
bloc.

## LLM via AI Gateway

Mode autorise et recommande si necessaire:

- envoyer un chapitre ou bloc de chapitres;
- inclure references Strong locales;
- inclure inventaire original;
- inclure V2 actuelle;
- inclure Strong manquants prioritises;
- demander seulement des decisions JSON structurees.

Modeles:

- commencer par `deepseek/deepseek-v4-flash` ou equivalent bon marche;
- escalader seulement des cas representatifs difficiles;
- ne jamais faire une application aveugle de sortie LLM.

Budget:

- utiliser `AI_GATEWAY_KEY` si disponible;
- documenter cout estime;
- si les credits sont insuffisants, terminer le backend deterministe et produire
  les commandes exactes pour reprendre.

## Pilote obligatoire: NBS Genese

Avant toute generalisation, prouver la V3 sur `nbs` `Gen`.

Genese 6 est un chapitre test obligatoire. Apres correction, verifier au moins:

- `Gen.6.1`: `humains` porte `H0120` ou raison explicite;
- `Gen.6.2`: `humains` porte `H0120`;
- `Gen.6.4`: `Nephilim` porte `H5303`;
- `Gen.6.4`: `humains` porte `H0120`;
- `Gen.6.6`: `Seigneur` porte `H3068`;
- `Gen.6.6`: `regretta` porte `H5162`;
- `Gen.6.6`: `humains` porte `H0120`;
- `Gen.6.7`: `Seigneur` porte `H3068`;
- `Gen.6.7`: `humains` porte `H0120`;
- `Gen.6.7`: `regrette` porte `H5162`;
- `Gen.6.9`: `genealogie` porte `H8435`;
- `Gen.6.11`: `pervertie` porte `H7843`;
- `Gen.6.12`: `pervertie` et `pervertis` portent `H7843` quand les occurrences
  originales le justifient;
- `Gen.6.13`: `aneantir` porte `H7843`.

Il faut aussi verifier qu'aucun nouveau tag manifestement faux n'est introduit
dans Genese 6.

## Rapports attendus

Creer:

```text
reports/semantic-complete-strong-v3-report.md
```

Le rapport doit inclure:

- diagnostic de la V2;
- cause des trous;
- architecture V3 implementee;
- nombre de Strong semantiques manquants avant/apres;
- Genese 6 avant/apres;
- metriques NBS Genese avant/apres;
- decisions appliquees;
- decisions rejetees;
- pending-human restants;
- cout LLM si utilise;
- commandes exactes pour reprendre;
- risques restants.

Si la generalisation multi-Bible est lancee, mettre aussi a jour:

```text
reports/strong-generation-multi-bible-report.md
```

## Tests attendus

Ajouter des tests automatises pour:

- detection de Strong semantiques manquants;
- validation d'une decision `accept-word`;
- validation d'une decision `accept-phrase`;
- validation d'une decision `accept-empty`;
- rejet d'un Strong absent de l'inventaire du verset;
- rejet d'un index invalide;
- rejet d'une phrase non contigue;
- correction du faux matching `window` / stem trop court;
- regression Genese 6 NBS pour les exemples obligatoires.

## Commandes de verification

Executer au minimum:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

Et pour la qualite Strong:

```sh
npm run generate:strong:hybrid -- --bible nbs --only Gen
npm run evaluate:strong:hybrid -- --gold Sg1910 --limit 1000
npm run evaluate:strong:hybrid -- --gold Darby --limit 1000
npm run evaluate:strong:hybrid -- --gold DarbyR --limit 1000
```

Si la logique est etendue au dela de NBS Genese, regenerer les Bibles concernees
et documenter les metriques.

## Criteres d'acceptation

Le goal est reussi seulement si:

- une V3 inventory-first existe et est executable;
- le pilote `nbs` `Gen` est traite;
- les trous obligatoires de Genese 6 sont corriges ou explicitement justifies;
- les decisions LLM/agent sont structurees et validees avant application;
- les overrides durables sont appliques sans committer de texte Bible complet;
- les metriques montrent une amelioration nette de couverture semantique;
- les tests couvrent les nouveaux composants;
- les validations finales passent;
- le rapport V3 documente la methode, les limites et les commandes de reprise.

## Conditions d'arret

Arreter et documenter si:

- la V3 exige un budget LLM indisponible;
- les donnees originales ou references sont manquantes;
- la validation automatique ne permet pas de distinguer correctement les bonnes
  decisions des mauvaises;
- la couverture augmente mais la precision devient manifestement mauvaise;
- le residuel demande un jugement humain massif.

En cas d'arret, produire quand meme:

- l'etat du prototype;
- les fichiers generes;
- le diagnostic sur NBS Genese;
- les metriques partielles;
- le cout/temps estime pour finir;
- la commande exacte pour reprendre.

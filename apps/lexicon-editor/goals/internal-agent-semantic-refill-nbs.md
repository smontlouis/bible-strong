# Internal Agent Semantic Refill NBS

## Objectif

Construire et executer une vraie passe `semantic-llm-refill` sans LLM externe:
utiliser uniquement des agents Codex internes pour arbitrer les Strong attendus
mais non places en `Reader`, puis appliquer automatiquement seulement les
decisions qui passent la validation locale stricte.

Le but immediat est d'ameliorer fortement la NBS enrichie:

```text
outputs/enriched/nbs/bible-nbs-strong-enriched.json
```

avec une baisse mesurable des `advanced empty` semantiques et une hausse des
Strong visibles en `Reader`, sans degrader la lisibilite.

## Contexte

La pipeline actuelle voit deja les cas problematiques, mais elle s'arrete trop
souvent en `pending-human`.

Exemple central:

```text
Gen.3.23 NBS: Le Seigneur Dieu le renvoya du jardin d'Eden...
H7971 est present dans l'original et dans Sg1910/Darby/DarbyR.
Sg1910: H7971 -> chassa
Darby:  H7971 -> mit [hors]
DarbyR: H7971 -> mit [hors]
NBS:    H7971 devrait etre place sur renvoya.
```

La pipeline actuelle le garde en `advanced empty` parce que:

- le transfert meme-verset ne reconnait pas `chassa/mit hors = renvoya`;
- le lexique global filtre `renvoya` pour `H7971` car `H7971` est tres
  polysemique;
- `semantic-refill` n'a pas encore de famille fiable pour `H7971`;
- le cas finit en `pending-human` au lieu d'etre arbitre par agent.

Autres exemples du meme type:

- `Gen.3.23`: `H5647 -> cultive`;
- `Gen.3.13`: `trompe` / `seduit` selon les references;
- tout Strong semantique attendu, supporte par les references, absent du
  `Reader`, avec un ou plusieurs mots francais plausibles dans le verset.

## Lire d'abord

- `reports/strong-bible-project-history.md`
- `reports/semantic-refill-nbs-report.md`
- `reports/canonical-enriched-strong-bible-report.md`
- `reports/semantic-complete-strong-v3-report.md`
- `goals/semantic-reader-coverage-v5.md`
- `.agents/skills/bible-to-strong/SKILL.md`
- `src/enrichedStrongBible.ts`
- `src/semanticRefill.ts`
- `src/semanticRefillQueue.ts`
- `src/semanticRefillAgentReview.ts`
- `src/semanticRefillLlm.ts`
- `src/readerAlignment.ts`
- `src/translationLexicon.ts`
- `src/curatedStrongOverrides.ts`
- `data/semantic-refill-lexicon.json`
- `data/curated-strong-overrides.json`

## Contraintes

- Ne pas utiliser `AI_GATEWAY_KEY`.
- Ne pas appeler d'API LLM externe.
- Utiliser des agents Codex internes pour l'arbitrage semantique.
- Preferer des agents peu couteux/rapides (`gpt-5.4-mini` ou equivalent low)
  sauf si une famille exige un raisonnement plus lourd.
- Ne jamais appliquer une decision agent sans validation locale stricte.
- Ne jamais committer les sorties bibliques completes sous `outputs/`.
- Ne pas demander a l'utilisateur de verifier des milliers de cas.

## Principe de la passe

La passe doit transformer ceci:

```text
Strong attendu + support original/reference + absent du Reader
=> candidat a arbitrer
```

en ceci:

```text
decision agent structuree
=> validation locale
=> override durable si valide
=> regeneration NBS
=> metriques
```

## Pipeline attendu

### 1. Construire la queue prioritaire

Partir de:

```text
outputs/semantic-refill/nbs/post-agent-v1/semantic-refill-pending.json
```

ou, si necessaire, relancer:

```sh
npm run strong:semantic-refill -- --bible nbs --only all --output-dir outputs/semantic-refill/nbs/internal-agent-v1 --audit
npm run strong:semantic-refill:queue -- \
  --input outputs/semantic-refill/nbs/internal-agent-v1/semantic-refill-pending.json \
  --output outputs/semantic-refill/nbs/internal-agent-v1/semantic-refill-agent-queue-manifest.json \
  --bible nbs \
  --group-by chapter \
  --max-items-per-task 80
```

La queue doit prioriser:

- Strong semantiques `semantic-high` ou `semantic-medium`;
- support reference fort: present dans `Sg1910 + Darby + DarbyR`;
- support original present;
- absent du `Reader`;
- versets ou la densite reader est inferieure aux references;
- verbes, noms, adjectifs et locutions importantes;
- mots francais non tagges ou faiblement tagges dans le verset.

Ne pas prioriser en premiere passe:

- articles;
- particules techniques;
- marqueurs objet;
- prepositions faibles;
- Strong sans porteur francais plausible.

### 2. Creer des lots agents intelligents

Ne pas envoyer tout le corpus brut a un seul agent.

Creer des lots par:

- famille Strong;
- livre;
- chapitre;
- type de probleme.

Exemples de familles prioritaires:

- `H7971`: envoyer, renvoyer, faire partir, chasser, mettre hors, lacher,
  laisser aller, etendre selon contexte;
- `H5647`: travailler, servir, cultiver, labourer;
- `H5377`: tromper, seduire, abuser, decevoir;
- `H0120`: humain, homme, personne;
- `H5162`: regretter, se repentir, renoncer, reconforter selon contexte;
- `H7843`: detruire, corrompre, pervertir, aneantir, perdre;
- `H8435`: genealogie, generation, descendance;
- `H7549/H8064`: voute, ciel, celeste;
- `H8317/H8318`: grouiller, foisonner, petites betes.

Chaque agent doit recevoir:

- les versets cibles tokenises avec `wordIndex`;
- les Strong manquants;
- le texte NBS;
- les inventaires `Reader`, `Advanced`, original et references;
- les rendus `Sg1910`, `Darby`, `DarbyR`;
- les candidats eventuels de la pipeline;
- les regles de rejet;
- le schema JSON strict.

### 3. Schema de sortie agent

Chaque agent doit ecrire un JSON sous:

```text
outputs/semantic-refill/nbs/agent-review/<family-or-scope>.json
```

Format:

```json
{
  "bible": "nbs",
  "scope": "H7971-family",
  "decisions": [
    {
      "ref": "Gen.3.23",
      "decision": "word",
      "strong": ["H7971"],
      "wordIndex": 4,
      "normalized": "renvoya",
      "confidence": 0.94,
      "reason": "H7971 est rendu par chassa/mit hors dans les references; renvoya est le porteur verbal NBS defensable dans ce verset.",
      "evidence": [
        "original:H7971",
        "Sg1910:chassa/H7971",
        "Darby:mit/H7971 hors",
        "DarbyR:mit/H7971 hors"
      ]
    }
  ],
  "rejected": [],
  "notes": []
}
```

Decisions autorisees:

- `word`;
- `phrase`;
- `empty`;
- `pending-human`;
- `reject`.

### 4. Validation locale obligatoire

Valider chaque sortie agent avec:

```sh
npm run strong:semantic-refill:agent-review -- \
  --input outputs/semantic-refill/nbs/agent-review/<file>.json \
  --output-dir outputs/semantic-refill/nbs/agent-review/<file>-validated
```

Le validateur doit rejeter:

- Strong absent de l'inventaire original/reference du verset;
- index invalide;
- `normalized` different du token cible;
- phrase non contigue;
- `normalizedPhrase` incorrecte;
- mot faible non justifie;
- Strong deja visible en Reader sur la meme cible;
- conflit avec un override existant;
- confiance trop basse.

Si le validateur actuel ne couvre pas un cas necessaire, l'ameliorer avant
d'appliquer les decisions.

### 5. Application

Appliquer seulement les decisions validees:

```sh
npm run strong:semantic-refill:agent-review -- \
  --input outputs/semantic-refill/nbs/agent-review/<file>.json \
  --output-dir outputs/semantic-refill/nbs/agent-review/<file>-applied \
  --apply
```

Les decisions appliquees doivent etre ajoutees dans:

```text
data/curated-strong-overrides.json
```

### 6. Regeneration et verification

Regenerer la NBS:

```sh
npx tsx src/enrichedStrongBible.ts generate --bible nbs
```

Verifier explicitement les exemples obligatoires:

- `Gen.3.23`: `H7971 -> renvoya`;
- `Gen.3.23`: `H5647 -> cultive`;
- `Gen.3.13`: le Strong attendu sur `trompe` si les references/original le
  confirment;
- au moins 20 autres cas issus de la premiere vague agent.

Verifier que les anciens `advanced empty` deviennent `hidden duplicate` quand
le Strong est represente en Reader.

### 7. Mesures attendues

Produire un rapport:

```text
reports/internal-agent-semantic-refill-nbs-report.md
```

Inclure:

- nombre de candidats analyses;
- nombre de lots agents;
- decisions brutes;
- decisions validees;
- decisions appliquees;
- decisions rejetees;
- exemples acceptes;
- exemples rejetes;
- delta `readerVisibleStrongCount`;
- delta `emptyStrongCount`;
- delta `phraseStrongCount`;
- delta `readerTokenCoverage`;
- delta `advancedTokenCoverage`;
- nombre de `pendingHuman` restants;
- familles qui restent a traiter.

Comparer au baseline actuel:

```text
readerVisibleStrongCount: 403770
advancedStrongCount: 488247
emptyStrongCount: 67724
phraseStrongCount: 8028
readerTokenCoverage: 0.5295
advancedTokenCoverage: 0.5503
originalRepresentationRate: 1.0000
```

## Strategie d'execution conseillee

Ne pas tenter les 58k pending d'un coup.

Faire des vagues:

1. vague pilote sur Genese, avec `H7971`, `H5647`, le cas `trompe/seduit`;
2. vague famille `H7971` sur tout l'AT;
3. vague famille `H5647`;
4. vagues par familles semantiques deja connues;
5. seulement ensuite, elargir aux livres ou chapitres les plus bas en densite
   reader/reference.

Apres chaque vague:

```text
agents -> validation -> apply -> regenerate -> audit -> report
```

## Criteres d'acceptation

- Aucun appel LLM externe.
- Au moins une vague agent complete executee.
- `Gen.3.23 H7971 -> renvoya` applique si valide.
- `Gen.3.23 H5647 -> cultive` applique si valide.
- Le cas `Gen.3.13 trompe/seduit` est soit applique, soit documente comme
  ambigu avec raison.
- Decisions agents validees localement avant application.
- NBS enrichie regeneree.
- Rapport final cree.
- Tests/verifications passent:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Si `npm run format:check` echoue sur des fichiers non lies deja sales, le
documenter sans formatter des fichiers hors scope.

## Condition d'arret

S'arreter et documenter si:

- les agents produisent trop de faux positifs pour une famille;
- le validateur local ne peut pas encore representer un cas important;
- les decisions necessitent une vraie expertise humaine;
- la regeneration complete devient bloquante;
- un conflit de donnees montre que les references ne sont pas d'accord.

Dans ce cas, produire quand meme:

- le JSON agent;
- les decisions rejetees;
- les raisons;
- les changements necessaires pour reprendre.

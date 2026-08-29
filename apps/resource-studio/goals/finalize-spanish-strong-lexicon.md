# Goal: produire un lexique Strong espagnol final, mature et importable

Construire une version espagnole complète du `strong_lexicon` à partir de la base STEP existante, en réutilisant l'expérience du pipeline FR, mais sans copier aveuglément les choix FR. L'objectif est d'obtenir un JSONL espagnol final couvrant les 22 717 entrées STEP, avec glossaire court, définition claire, notes éventuelles, validation automatique stricte, review ciblée des cas faibles, et aucun write en DB tant que la qualité finale n'est pas validée.

## Contexte

Le pipeline FR a montré que la meilleure approche est:

1. pilote diversifié;
2. production complète;
3. classification automatique stricte;
4. retries ciblés sur les cas faibles;
5. review manuelle finale;
6. audit indépendant;
7. import DB seulement après validation explicite.

Pour l'espagnol, on doit reprendre cette architecture, mais adapter les prompts, les termes verrouillés, les faux amis et les règles qualité à la langue espagnole.

## Contraintes

- Source d'autorité principale: `data/dictionaries/strong_lexicon.sqlite`.
- Ne pas utiliser le lexique FR comme source d'autorité; il peut seulement servir de signal comparatif ou de garde-fou ponctuel.
- Produire une traduction espagnole naturelle, biblique, précise, non littérale quand une traduction mot à mot serait mauvaise.
- Protéger strictement les noms propres et faux amis:
  - `Ham` ne doit jamais devenir `jamón`.
  - `Job` ne doit jamais devenir `trabajo`.
  - Les noms de personnes, lieux, peuples et entités doivent rester bibliquement reconnaissables.
- Préserver les nuances théologiques importantes:
  - pacto / alianza;
  - justicia / justificación;
  - expiación / propiciación;
  - misericordia / gracia;
  - espíritu;
  - palabra / verbo;
  - santo / santidad;
  - pecado / transgresión / iniquidad.
- Ne pas inventer de Strong, références, versets, étymologies ou sens absents de STEP.
- Supprimer les références Strong parasites dans les définitions traduites.
- Ne pas écrire dans la DB avant validation complète.

## Pipeline attendu

1. Créer un script de génération espagnole basé sur le pipeline FR.
2. Ajouter des locked terms ES pour les termes théologiques, bibliques, grammaticaux et noms propres à risque.
3. Générer un premier batch pilote diversifié:
   - grec;
   - hébreu;
   - noms propres;
   - termes théologiques;
   - entrées courtes;
   - entrées longues;
   - entrées morphologiquement ou sémantiquement ambiguës.
4. Comparer plusieurs modèles si nécessaire, mais privilégier qualité/stabilité plutôt que coût minimal.
5. Générer toute la production espagnole.
6. Classer les entrées en `accepted`, `review_needed`, `rejected`.
7. Relancer automatiquement les entrées faibles avec prompts ciblés:
   - sens trop court;
   - gloss vide ou faible;
   - warning de confiance;
   - résidu anglais;
   - nom propre suspect;
   - terme théologique mal rendu.
8. Faire une review manuelle des derniers cas restants, comme pour le FR.
9. Produire les fichiers finaux et rapports qualité.
10. Ne proposer l'import DB qu'après 0 `review_needed` ou une liste résiduelle explicitement acceptée.

## Sorties attendues

- `outputs/lexicon-es/strong_lexicon_es.candidates.jsonl`
- `outputs/lexicon-es/strong_lexicon_es.accepted.jsonl`
- `outputs/lexicon-es/strong_lexicon_es.remaining-after-retries.json`
- `outputs/lexicon-es/strong_lexicon_es.final.jsonl`
- `outputs/lexicon-es/strong_lexicon_es.final-review-needed.json`
- `outputs/lexicon-es/strong_lexicon_es.final-rejected.json`
- `reports/lexicon-es-production.md`
- `reports/lexicon-es-retry-summary.md`
- `reports/lexicon-es-final-quality.md`
- `reports/lexicon-es-final-samples.md`
- `reports/lexicon-es-final-import-plan.md`

## Critères d'acceptation

- 22 717 entrées finales.
- 22 717 `accepted`, idéalement 0 `review_needed`, 0 `rejected`.
- JSONL parseable à 100%.
- Aucun doublon `stepEntryId`.
- Aucun glossaire espagnol vide.
- Aucune définition espagnole vide.
- Aucun HTML leak.
- Aucun Strong inventé.
- Aucun résidu anglais détecté.
- Aucun faux ami critique détecté sur les noms propres.
- Les termes théologiques sensibles sont cohérents sur l'ensemble du lexique.
- Rapport final généré.
- Plan d'import DB généré.
- Aucun write DB effectué sans validation explicite.

## Audit final obligatoire

Avant de considérer le goal terminé, lancer une vérification indépendante qui contrôle:

- nombre de lignes;
- unicité des `stepEntryId`;
- distribution des statuts;
- parse JSONL;
- HTML;
- champs vides;
- résidus anglais;
- faux amis espagnols critiques;
- Strong inventés;
- fichiers `review_needed` et `rejected`.

Le résultat attendu est:

```json
{
  "lines": 22717,
  "uniqueIds": 22717,
  "status": {
    "accepted": 22717,
    "review_needed": 0,
    "rejected": 0,
    "other": 0
  },
  "parseErrors": 0,
  "html": 0,
  "emptyGloss": 0,
  "emptyMeaning": 0,
  "invented": 0,
  "english": 0,
  "falseFriends": 0,
  "reviewFile": 0,
  "rejectedFile": 0
}
```

## Décision produit

Si ces critères sont atteints, le lexique espagnol peut être considéré comme:

- prêt pour intégration produit;
- utilisable comme source ES principale;
- traçable et régénérable;
- suffisamment mature pour une bêta ou une mise en production progressive.

Il ne doit pas être présenté comme un dictionnaire académique définitif: garder une capacité de correction humaine et de patchs post-import.

# Reconstruction Strong face à Concordance.bible

Expérience locale, sans appel de modèle, publication ni génération de Bibles complètes.
Le moteur initial est celui de `dec602f8db67f94476f7f50a4289de5c405640a1`.
Le candidat commun est dans `src/strongConcordanceRefinement.ts` ; il reste expérimental
et ne modifie pas le générateur de production.

Les résultats finaux sont sous `outputs/strong-concordance-night/final-v2/`.
La première réserve a été retirée après découverte de titres et de boutons de
navigation dans l’import. Les premiers résultats, le motif du retrait et le gel
initial restent conservés dans le dossier parent. Les règles de prédiction sont
identiques avant et après ce retrait ; huit nouveaux chapitres servent de réserve.

## Rejouer depuis une nouvelle destination

Depuis `apps/resource-studio`, avec les dépendances Yarn du dépôt, Python 3.12+
et Node avec `node:sqlite` (exécution vérifiée avec Node 23.7.0) :

```sh
python3 scripts/strong-concordance-night/run.py init \
  --root outputs/strong-concordance-night-replay \
  --cache outputs/strong-concordance-night/final-v2/acquisition
python3 scripts/strong-concordance-night/acquire.py \
  --root outputs/strong-concordance-night-replay
yarn exec node --import tsx scripts/strong-concordance-night/prepare.ts \
  outputs/strong-concordance-night-replay
python3 scripts/strong-concordance-night/run.py baseline \
  --root outputs/strong-concordance-night-replay
python3 scripts/strong-concordance-night/run.py development \
  --root outputs/strong-concordance-night-replay
python3 scripts/strong-concordance-night/run.py freeze \
  --root outputs/strong-concordance-night-replay
python3 scripts/strong-concordance-night/run.py test \
  --root outputs/strong-concordance-night-replay
python3 scripts/strong-concordance-night/run.py verify \
  --root outputs/strong-concordance-night-replay
yarn exec node --import tsx scripts/strong-concordance-night/audit.ts \
  outputs/strong-concordance-night-replay
python3 scripts/strong-concordance-night/report.py \
  --root outputs/strong-concordance-night-replay
```

Avec le cache fourni, l’acquisition n’effectue aucune requête. Sans `--cache`,
elle récupère les seules pages publiques du plan, avec au moins une seconde entre
les requêtes, sans authentification ni contournement. Une page sans Strong,
un cache modifié, des mots non conservés ou du contenu lexical hors des balises
attendues font échouer l’import. Les URL, dates, empreintes et HTML restent locaux.

Les données prérequises sont `data/strongs/{Sg1910,Darby,DarbyR}.csv` et les six
fichiers `TAHOT`/`TAGNT` dans `data/external/stepbible/amalgamated/`.
Le dictionnaire de production n’est pas nécessaire et son contrôle V3 est intact.
Un dictionnaire neutre, vérifié à zéro candidat, permet de rejouer le code initial
sans lui donner les traductions françaises historiques de provenance insuffisante.

`init` refuse une destination existante ; l’acquisition et la préparation vérifient
leurs caches. `baseline` conserve les prédictions déjà scellées. `freeze` refuse un
second gel. `test` refuse un code ou un plan modifié. Pour tester de nouvelles règles
après consultation de la réserve, créer un nouveau plan avec d’autres chapitres.
Un rejeu de la présente réserve vérifie la reproductibilité, pas une nouvelle indépendance.

## Séparation des informations

1. `acquisition/` conserve les pages ; `evaluator-only/` conserve `data-pa`, les
   annotations et les relations discontinues. Un identifiant source partagé par
   plusieurs mots compte une fois ; deux identifiants portant le même Strong
   restent distincts. Notes, titres et interface sont exclus du texte biblique.
2. `masked/` ne contient que les références et le texte. Aucun lemme, Strong,
   symbole de vide ou identifiant d’occurrence cible n’est transmis au moteur.
3. `environments/` est une liste fermée de témoins autorisés et de sources STEP.
   Le scénario `target-excluded` conserve LSG ; `family-excluded` l’exclut aussi.
   Les témoins S21/NEG et leurs caches ne sont jamais des entrées. Pour les
   contrôles Darby/DarbyR, les deux éditions sont exclues ensemble.
4. `baseline/` contient la sortie initiale et son empreinte avant amélioration.
   `variants/` contient les prédictions et chaque changement avec ses preuves.
   Les compteurs par famille ne considèrent pas DarbyR comme un second vote Darby.
5. L’évaluateur est un autre processus. `verify` retire temporairement l’accès aux
   pages et aux annotations cibles, relance une prédiction initiale et exige la
   même empreinte. Il vérifie aussi les données, l’archive de code et le rejeu du candidat.

Il s’agit d’une séparation de processus et d’entrées contrôlées, pas d’une barrière
de sécurité contre un programme malveillant. `fetch` est désactivé dans les moteurs.
Les autres témoins peuvent couvrir les chapitres évalués : on mesure le transfert
vers une édition masquée, pas une traduction de chapitres sans témoins.

## Variantes et mesures

- `numbers` : cardinaux STEP vers chiffres, avec cardinalité, identité et nom voisin.
- `heads` : limites d’affichage apprises de trois couples famille/verset cohérents,
  ou porteur simple unique des témoins du même verset ; la relation complète reste tracée.
- `accountable` : retire les affirmations sans résolution source et affiche les
  seuls vides dont l’absence et l’ancrage sont séparément établis par la règle existante.
- `carriers-only` : nombres et limites, pour isoler le gain d’accord éditorial.
- `combined` : les trois règles, politique produit sélectionnée avant la réserve.
- `two-family-heads` : deux familles obligatoires pour les limites d’expression.
- `edition-adapted` : chiffres seulement pour S21 et deux familles exigées pour
  ses limites ; contre-expérience explicite, sans règle propre à un verset.

Les profils initiaux S21, NEG79 et le profil commun NBS ont les mêmes paramètres
d’alignement ; leurs différences descriptives ne constituent pas une amélioration.
L’adaptation ci-dessus change réellement les règles et est mesurée séparément.

`evaluation/` donne précision/rappel/F1 exacts et chevauchants, inventaire,
cardinalité, visible/vide, ancrage, identité, incertitude et versets entièrement
comptabilisés, par testament, genre et difficulté. Les catégories de difficulté
peuvent se chevaucher. Une sortie entièrement incertaine reçoit un rappel et un F1
nuls. L’identité externe est notée seulement quand les numéros et identités de
toute la séquence annotée concordent univoquement avec STEP ; les autres versets
restent dans les mesures de porteur, sans prétendre avoir validé leur identité source.

Le score compare des choix éditoriaux. Il ne transforme ni les balises de
Concordance ni nos règles en vérité sémantique. Les jugements dans le rapport
et les revues locales sont ceux de l’assistant, exposés aux témoins.

## Tests

```sh
yarn typecheck
yarn exec node --import tsx --test tests/strongConcordance*.test.ts
python3 -m unittest discover -s scripts/strong-concordance-night -p 'test_*.py'
yarn exec node --import tsx --test scripts/strong-*/*.test.ts
yarn exec tsc --noEmit --target ES2022 --module NodeNext \
  --moduleResolution NodeNext --strict --skipLibCheck --esModuleInterop \
  --resolveJsonModule scripts/strong-concordance-night/*.ts
```

Le rapport français distingue les échecs de lexique et de build préexistants des
nouveaux tests. Aucun texte intégral de Bible ni donnée d’accès ne doit être suivi
par Git ; tous les corpus, journaux et sorties restent dans `outputs/`.

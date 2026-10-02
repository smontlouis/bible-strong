# Candidates Strong complètes S21 et NEG79

Ce parcours local raccorde la politique mesurée par les expériences Concordance
au ledger canonique et à ses exports. Il ne publie rien, ne lance aucun modèle,
et ne traite que `neg79` et `s21`. Une candidate peut contenir des erreurs de
placement ; la vérification structurelle n'est pas une certification sémantique.

## Rejeu

Depuis `apps/resource-studio`, avec Node, les dépendances Yarn et les données
locales mentionnées dans le manifeste de livraison :

```sh
python3 scripts/strong-candidates/run.py prepare --root outputs/strong-candidates-replay
python3 scripts/strong-candidates/run.py correspondence --root outputs/strong-candidates-replay
python3 scripts/strong-candidates/run.py refine-correspondence --root outputs/strong-candidates-replay
python3 scripts/strong-candidates/run.py integration --root outputs/strong-candidates-replay \
  --previous outputs/strong-concordance-reading-groups
python3 scripts/strong-candidates/run.py freeze --root outputs/strong-candidates-replay
python3 scripts/strong-candidates/run.py generate --root outputs/strong-candidates-replay
python3 scripts/strong-candidates/run.py verify --root outputs/strong-candidates-replay
```

`integration` exige les anciens résultats locaux et mesure la parité des placements,
identités et états sur sept scénarios déjà consommés. Ce n'est pas une nouvelle
réserve. Ce contrôle peut être omis pour un simple rejeu des candidates si ces
anciens résultats sont indisponibles. `--edition neg79` ou `--edition s21` limite
les étapes `correspondence`, `generate` et `verify`. Utiliser un nouveau répertoire
pour une nouvelle génération : un SQLite existant n'est pas écrasé. Le pilote
accorde jusqu'à 16 Gio au processus Node ; les deux générations sont séquentielles.

Une évaluation diagnostique séparée peut comparer les textes natifs aux chapitres
externes déjà acquis, après génération :

```sh
python3 scripts/strong-candidates/audit.py outputs/strong-candidates-replay s21
python3 scripts/strong-candidates/audit.py outputs/strong-candidates-replay neg79
node --import tsx scripts/strong-candidates/evaluate.ts \
  outputs/strong-candidates-replay outputs/strong-concordance-reading-groups s21
node --import tsx scripts/strong-candidates/evaluate.ts \
  outputs/strong-candidates-replay outputs/strong-concordance-reading-groups neg79
```

`refine-correspondence` agit avant le gel : il remplace un regroupement seulement
si les textes normalisés fournissent une bijection unique, complète et monotone
sur tout le groupe de versets. Toutes les références natives et sources sont
conservées. Les conflits restants sont signalés dans le manifeste et leurs
placements sont retenus comme incertains par le générateur. Aucun Strong cible
ne participe à cette correction de numérotation. Les anciennes propositions du
détecteur et les preuves des réparations restent enregistrées.

Seules les séquences de tokens identiques, à la casse et aux apostrophes
typographiques près, sont comparées. Aucun accent ni mot n'est remplacé. Les
autres cas sont exclus avec leur raison, sans remapper arbitrairement des indices.

## Entrées et séparation

Le préparateur copie les textes sans Strong, les trois témoins autorisés
`Sg1910.csv`, `Darby.csv`, `DarbyR.csv`, les six fichiers TAHOT/TAGNT et les tables
d'identité TBESH/TBESG. Ces dernières servent uniquement à enrichir les identités
de l'export, après la prédiction. Les octets et le code sont figés. Le prédicteur
travaille dans `environment/`, sans lexique français historique, corrections
cibles ni caches de modèles. Son dictionnaire neutre est vérifié comme contenant
zéro candidat. `fetch` est interdit. Les annotations externes restent dans le
répertoire de l'expérience précédente, accessible seulement à l'évaluateur.

Le résolveur conserve chaque identité source et les relations de traduction.
`concordanceDisplay: "expressions"` active la projection mesurée dans
`generateStrongLedger`; `"heads"` conserve la convention CSV des contrôles. Les
annotations retirées de l'affichage restent dans le ledger avec leur provenance.
Un vide exige une décision d'absence et un ancrage distinct. Un changement de
source ou de politique invalide les empreintes, y compris lors de l'export JSONL.

Les correspondances de versets ambiguës et les projections sur plusieurs versets
sans témoin aligné restent incertaines. Les lignes STEP dont la notation de
référence n'est pas comprise sont conservées sous `unparsedCanonicalSource`,
avec fichier, ligne, empreinte et références possibles. Elles ne sont ni perdues
ni interprétées comme des absences ; les versets concernés ne sont pas déclarés
entièrement comptabilisés. Leur inventaire ne devine pas une cardinalité de
composants lexicaux que l'importeur n'a pas établie.

## Sorties

- `generated/<édition>/bible-<édition>-strong.jsonl` : texte intégral avec les
  seules annotations retenues pour le lecteur, et son manifeste.
- `generated/<édition>/bible-<édition>-strong.sqlite` : ledger d'auteur complet,
  incluant décisions, traces des raffinements, propositions et incertitudes.
- `audit/<édition>/resolutions.jsonl` : décisions et preuves par verset.
- `audit/<édition>/unassigned-source.jsonl` : sources non attribuées ou non
  interprétées, jamais étiquetées « absentes ».
- `audit/<édition>/risks.jsonl` : répétitions, variantes mineures et difficultés
  structurelles à examiner. Un signal de risque n'est pas une erreur démontrée.
- `audit/<édition>/verification.json` : effectifs, contrôles et empreintes.

Les TSV avancés et les vues de diagnostic conservent des propositions incertaines.
Ils ne constituent pas le résultat lecteur. Ces fichiers sont des artefacts
d'auteur locaux, pas des sidecars publiés ou activés dans l'application.

Le vérificateur relit le SQLite sans charger la Bible entière en mémoire, contrôle
texte, rendu, inventaires, identités physiques uniques et séparation des états,
puis exporte le JSONL. Il distingue les composants source modélisés des lignes
brutes non comprises. La source locale peut elle-même présenter des défauts :
aucun texte ou découpage n'est corrigé silencieusement.

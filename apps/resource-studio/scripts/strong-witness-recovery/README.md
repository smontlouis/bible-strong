# Récupération de porteurs Strong à partir des témoins

La politique `attested-neighbor-recovery-v3` utilise uniquement les témoins
autorisés. Elle n'accepte ni annotations cibles, ni identifiant d'édition, ni
dictionnaire historique. Elle est opt-in dans `generateStrongLedger` via
`concordanceRecovery: true`, avec `concordanceDisplay` activé.

La livraison retenue est dans `outputs/strong-witness-recovery-2026-10-02/final`.
Les essais du dossier parent et de `recheck` sont retirés. Ils ont révélé des
confusions avec des auxiliaires et des mots grammaticaux. Leurs réserves de 433
et 476 versets sont désormais du développement ; elles ne peuvent plus démontrer
une généralisation indépendante.

## Politique

Une récupération lexicale exige une occurrence source unique, sans variante
non résolue, un mot cible libre et unique, au moins deux passages attestés et
deux familles de témoins. Darby et DarbyR ne constituent qu'une famille. Le mot
doit se trouver entre deux voisins lexicaux déjà placés, dans un intervalle
court sans frontière forte de phrase. Les auxiliaires et les mots grammaticaux
sont exclus par les filtres communs. Les conflits entre nouvelles propositions
sont rejetés ensemble.

Les composés traités ont deux éléments commençant par une majuscule, séparés par
un trait d'union. Une occurrence nominale déjà placée doit justifier un élément,
et une occurrence nominale proche doit justifier l'autre. Chaque élément exige
ses propres attestations. Le texte et les placements déjà présents restent intacts.
Les nombres, répétitions ambiguës et lectures alternatives restent hors de cette
récupération. Elle ne crée jamais de Strong vide.

Le lexique sans contexte, les voisins seuls, les composés seuls et leur combinaison
constituent les quatre ablations. La politique commune ne connaît pas l'édition.
La contrainte de deux familles rend les contrôles avec une seule famille
inchangés par construction : ce n'est pas une preuve de gain dans ce scénario.

## Données à conserver

Les entrées et résultats volumineux restent ignorés par Git. Un rejeu exige les
artefacts antérieurs et leurs empreintes :

- `outputs/strong-source-context-2026-10-02/recheck`, référence antérieure ;
- les deux essais retirés de cette expérience, pour les prédictions initiales
  des chapitres consommés et la sélection de réserve ;
- les pages et reçus d'acquisition du dossier `final/acquisition` ;
- les textes, témoins et sources STEP des environnements autorisés.

Le programme d'acquisition impose un intervalle entre requêtes, vérifie le cache
et extrait les annotations dans `evaluator-only`. Le programme prédictif vérifie
les empreintes et ne reçoit que les textes masqués et les témoins autorisés.
Cette séparation n'est pas un bac à sable du système d'exploitation.

## Rejouer les contrôles

Depuis `apps/resource-studio`, pour reproduire la sélection finale dans un nouveau
dossier (ne pas écraser une livraison déjà gelée) :

```sh
python3 scripts/strong-witness-recovery/init.py \
  --root outputs/witness-replay \
  --retired outputs/strong-witness-recovery-2026-10-02/recheck \
  --seed witness-recovery-shared-guard-v3
node --import tsx scripts/strong-witness-recovery/prepare.ts outputs/witness-replay development
python3 scripts/strong-witness-recovery/run.py development --root outputs/witness-replay
python3 scripts/strong-witness-recovery/freeze.py --root outputs/witness-replay
```

Restaurer ensuite le cache HTML et ses reçus sous `outputs/witness-replay/acquisition`
pour retrouver exactement les annotations mesurées, puis :

```sh
python3 scripts/strong-witness-recovery/acquire.py --root outputs/witness-replay
node --import tsx scripts/strong-witness-recovery/prepare.ts outputs/witness-replay test
python3 scripts/strong-witness-recovery/reserve.py --root outputs/witness-replay
python3 scripts/strong-witness-recovery/verify-integration.py --root outputs/witness-replay
python3 scripts/strong-witness-recovery/report-data.py --root outputs/witness-replay
```

L'intégration compare placements, états, identités et texte aux sorties du moteur
pur dans les sept scénarios. Le rejeu masque temporairement les pages, les labels
et les scores, puis exige des prédictions identiques octet pour octet. Les règles
ne doivent plus changer après ouverture d'une réserve ; tout changement impose
de retirer cette réserve avant une nouvelle mesure indépendante.

## Réparation textuelle NEG79 et génération complète

`repair-neg79.ts` compare le texte canonique local aux textes des témoins autorisés,
après retrait de leurs annotations et notes. Une correspondance sur le verset
entier, sans changement de lettres ni de ponctuation, peut justifier l'insertion
d'un espace à une jonction suspecte minuscule/majuscule. Les changements de casse
et d'apostrophe ne sont utilisés que pour vérifier le témoin. Le texte cible
conserve tous ses caractères ; les positions de présentation sont ajustées.

La preuve conserve les positions insérées, les empreintes et les témoins. Retirer
ces espaces reconstitue exactement le texte antérieur. Une nouvelle révision
canonique est créée et validée. Les cas sans preuve restent explicitement recensés.

Pour un dossier déjà muni de `baseline-origin.json` et ne contenant pas encore
`text-repair`, le calcul initial de cette réparation se lance ainsi :

```sh
node --import tsx scripts/strong-witness-recovery/repair-neg79.ts \
  outputs/nouvelle-experience /chemin/vers/le/canonique-neg79.json
```

L'initialiseur de rejeu copie la réparation figée depuis l'essai précédent : ne
pas la réécrire. Avec ce dossier `text-repair` déjà présent :

```sh
python3 scripts/strong-witness-recovery/prepare-full.py --root outputs/witness-replay
python3 scripts/strong-candidates/run.py freeze --root outputs/witness-replay/full
python3 scripts/strong-candidates/run.py generate --root outputs/witness-replay/full
python3 scripts/strong-candidates/run.py verify --root outputs/witness-replay/full
python3 scripts/strong-witness-recovery/audit-full.py --root outputs/witness-replay
python3 scripts/strong-witness-recovery/sample-full.py --root outputs/witness-replay
```

L'audit exige la conservation de toutes les identités source et de tous les
porteurs antérieurs sur les textes inchangés. Les seules différences textuelles
autorisées sont celles du reçu de réparation. Les hypothèses et leurs preuves
restent dans les ledgers ; le lecteur compact affiche les porteurs retenus.
Aucune commande de ce parcours ne publie ni n'active une ressource.

# Variantes mineures, expressions et occurrences répétées

Suite autonome de l’expérience `068ec2107`, sans modèle, publication ni génération
intégrale. Les anciens chapitres réservés sont désormais du développement. Le plan
figé sélectionne huit nouveaux chapitres, sans consulter leurs annotations cibles.

Le scénario principal conserve l’exclusion des annotations S21/NEG, des corrections
historiques et du dictionnaire français non attesté pour ce test. L’exclusion de la
famille Segond et les contrôles LSG/Darby/DarbyR sont maintenus. Darby/DarbyR ne sont
jamais deux familles indépendantes. Tous les corpus et résultats restent dans
`outputs/strong-concordance-reading-groups/`, ignoré par Git.

## Règles mesurées

- **Lectures** : les petits indicateurs TAHOT sur une lecture L sans variante de
  sens ne bloquent plus le porteur lexical. Pour TAGNT, on exige la ligne primaire
  N, les trois groupes d’éditions, uniquement des indicateurs mineurs, et la même
  identité STEP et catégorie grammaticale dans les alternatives décrites. Les
  lignes alternatives seules, changements lexicaux, variantes majeures ou
  descriptions non comprises restent incertains. Les variantes de grammaire et
  le choix d’édition restent explicitement non adjugés.
- **Expressions** : une conjonction ou préposition source peut nécessiter une
  expression française dont le mot central est lexical. On préserve cette
  expression ; un porteur français déjà fonctionnel, comme un simple connecteur,
  n’est pas étendu à son contexte. Le morphème lexical hébreu est distingué de ses
  préfixes. Aucune expression particulière ni numéro Strong n’est codé en exception.
- **Liens** : un lien conjoin STEP peut départager les occurrences d’un même
  article français. On exige un nom/adjectif/participe identifiable, un porteur
  exact existant, une proximité immédiate sans ponctuation et la même forme française de
  l’article. Les déplacements concurrents sont atomiques ; aucun porteur occupé
  n’est volé. Les changements de construction française restent hors de cette règle.

`legacy` rejoue le module de `068ec2107`, sur le même lecteur canonique initial.
`readings`, `expressions` et `links` isolent les trois changements ;
`readings-expressions` et `all` mesurent leurs combinaisons. `edition-adapted`
exige deux familles pour les limites d’expression S21, afin de tester explicitement
l’apport d’une adaptation. Le moteur commun ne reçoit ni le nom d’édition ni les
annotations cible.

`display-adapted` conserve les expressions grammaticales pour les cibles dont la
référence publique regroupe les occurrences en expressions (S21/NEG), et conserve
le choix historique de tête d’affichage pour les contrôles CSV (LSG/Darby/DarbyR).
Cette adaptation porte sur la convention d’affichage du corpus, pas sur une règle
lexicale propre à une Bible. La relation complète reste enregistrée dans tous les
cas. L’hypothèse est choisie sur le développement et comparée au moteur commun.

Les cas source, les textes et les identités restent strictement conservés. Une
réinterprétation de lecture ne transforme jamais une recherche infructueuse en
absence. Les vides grammaticaux sont recalculés par la règle bornée existante,
avec absence et ancrage séparés.

## Rejeu

Depuis `apps/resource-studio`, avec les données et dépendances du premier cycle :

```sh
python3 scripts/strong-concordance-followup/run.py init \
  --root outputs/strong-followup-replay \
  --cache outputs/strong-concordance-reading-groups/acquisition
python3 scripts/strong-concordance-night/acquire.py --root outputs/strong-followup-replay
yarn exec node --import tsx scripts/strong-concordance-night/prepare.ts outputs/strong-followup-replay
python3 scripts/strong-concordance-night/run.py baseline --root outputs/strong-followup-replay
python3 scripts/strong-concordance-followup/run.py development --root outputs/strong-followup-replay
# Choisir et consigner la politique sur le développement avant ce gel.
python3 scripts/strong-concordance-followup/run.py freeze --root outputs/strong-followup-replay --selected-policy display-adapted
python3 scripts/strong-concordance-followup/run.py test --root outputs/strong-followup-replay
python3 scripts/strong-concordance-followup/run.py verify --root outputs/strong-followup-replay
python3 scripts/strong-concordance-followup/report.py --root outputs/strong-followup-replay
```

`initial-code.tar` archive le lecteur canonique de `dec602f8d` ; `previous-code.tar`
archive le module précédent de `068ec2107`. Aucun élément de réponse cible ne
participe aux lexiques ou caches prédictifs. Les corpus dérivés sont indexés par
empreintes et les lignes STEP sont vérifiées contre leur empreinte enregistrée
dans le lecteur initial. Le rejeu cache les pages, annotations et évaluations
cibles, puis exige les mêmes prédictions.

Le prédicteur et l’évaluateur sont des processus distincts. L’éligibilité au score
d’identité et les strates de difficulté sont fixées à partir de l’interprétation
source initiale ; une correction ne peut pas améliorer le score en changeant son
propre dénominateur. Un score local supplémentaire mesure les paires article/nom
dont les ordinaux et Strong concordent avec la référence. Le nom lexical unique
est un second repère : un numéro d’article fréquent seul ne suffit pas. Ce score
ne revendique pas une validation indépendante des cas qui ne sont pas comparables.

La réserve ne doit être ni évaluée ni inspectée pour régler les règles avant le
gel. Après inspection, tout changement de règle exige une autre réserve. Un rejeu
du même plan mesure la reproductibilité, pas une nouvelle généralisation.

## Validation

```sh
yarn typecheck
yarn exec node --import tsx --test tests/strongSourceReading.test.ts \
  tests/strongConcordanceFollowup.test.ts tests/strongConcordanceIdentity.test.ts
yarn exec node --import tsx scripts/strong-concordance-followup/canonical-canary.ts
```

Le canary utilise uniquement Exode 20.4, Luc 22.9 et Luc 22.64, déjà consultés :
il vérifie deux récupérations lexicales et le maintien d’une variante majeure
incertaine dans le vrai générateur canonique. Les erreurs de lexique et de build
préexistantes restent distinguées des régressions dans le rapport français.

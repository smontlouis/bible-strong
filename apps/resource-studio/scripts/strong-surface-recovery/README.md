# Récupération de formes françaises attestées

Cette expérience prolonge les candidates S21/NEG79 du 2 octobre 2026.
Le moteur reçoit les occurrences sources, le texte cible sans annotations,
les témoins autorisés et un index de flexions françaises indépendant.
Il ne consulte ni les annotations ni les lemmes éditoriaux de Concordance.bible.

Le dossier final est `outputs/strong-surface-recovery-2026-10-02/recheck`.
Son parent conserve un premier essai retiré : un Strong de « jaillit » était
attribué à « venu » après une virgule en Nombres 16.35. Les 345 versets de
cette première réserve sont ensuite devenus du développement.

## Critères du moteur commun

- Lecture source résolue, une identité et une composante par occurrence.
- Code Strong corroboré par deux familles de témoins dans le verset source natif.
- Deux voisins lexicaux déjà placés délimitent une zone courte ; pas de franchissement
  de ponctuation séparant les propositions, y compris les virgules.
- Attestations lexicales dans deux familles et au moins deux autres passages,
  avec exclusion de l'adresse cible **et** de l'adresse source native.
- Pour une flexion nouvelle, les familles doivent s'accorder dans chacun
  d'au moins deux autres passages ; un lemme ambigu ne suffit pas.
- Les candidats moins solidement attestés restent des concurrents : le filtrage
  d'un candidat ne crée pas artificiellement une certitude sur un autre.
- Une répétition doit avoir une affectation complète, unique et ordonnée pour
  les occurrences concernées. Aucun mot ni complément déjà attribué n'est pris.
- Les anciens placements, relations et vides restent inchangés. Un échec
  reste une incertitude, jamais une preuve d'absence.

Les suffixes grammaticaux comme `-il`, `-toi`, `-le-moi`, `-ci` et `-là` sont
reconnus dans des classes compatibles. Les mots composés quelconques et les noms
propres ne sont pas découpés par simple présence d'un trait d'union.
Les limites du mot porteur et celles de sa relation de traduction restent distinctes.

## Flexions indépendantes

`prepare-morphology.py` lit l'export français Kaikki déjà présent localement.
Il conserve uniquement les champs `word`, `pos`, `forms.form` et
`senses.form_of.word`, pour les entrées `lang_code=fr`. Il ne lit aucun glossaire
anglais ni numéro Strong. Les accents sont conservés et les lemmes concurrents
restent ambigus. Les associations aux Strong viennent exclusivement des témoins
autorisés par le scénario, avec Darby/DarbyR comptés comme une seule famille.
Le reçu enregistre l'empreinte du fichier brut et de l'index produit.

## Rejouer

Depuis `apps/resource-studio`, avec les corpus et sorties historiques conservés :

```sh
# Rejeu de la livraison existante, avec son code figé :
python3 scripts/strong-surface-recovery/verify.py \
  --root outputs/strong-surface-recovery-2026-10-02/recheck
python3 scripts/strong-surface-recovery/verify-positive.py \
  --root outputs/strong-surface-recovery-2026-10-02/recheck
```

Pour un nouveau dossier d'expérience préparé, les étapes sont :

```sh
# Les gros diagnostics historiques peuvent être lus directement en gzip.
python3 scripts/strong-surface-recovery/run.py development --root <experiment>
python3 scripts/strong-surface-recovery/freeze.py --root <experiment>
python3 scripts/strong-witness-recovery/acquire.py --root <experiment>
node --import tsx scripts/strong-witness-recovery/prepare.ts <experiment> test
python3 scripts/strong-surface-recovery/reserve.py --root <experiment>
python3 scripts/strong-surface-recovery/verify.py --root <experiment>
python3 scripts/strong-surface-recovery/verify-positive.py --root <experiment>
python3 scripts/strong-surface-recovery/report-data.py --root <experiment>
```

`init.py` utilise un `baseline-origin.json`, un snapshot `baseline-code` et les
environnements témoins déjà préparés. Avec `--previous`, il incorpore les anciennes
réserves au développement et sélectionne de nouveaux chapitres sans annotations.
Le générateur `native.ts` exécute le code figé et recopie seulement les entrées
autorisées. Les copies utilisent des clones APFS quand disponibles. Les sorties
volumineuses sont enregistrées en gzip dès leur création.

`verify.py` masque les répertoires des pages, annotations et scores, puis vérifie
la parité du générateur réel avec la règle pure et un rejeu identique. Les variantes
testent séparément les suffixes, répétitions et flexions, une exigence de témoins
affaiblie, leur combinaison, puis la politique prudente avec affichage commun
ou conservant les conventions par édition. Les essais rejetés restent consultables.

Pour la seconde réserve, une dernière revue de code a renforcé l'exclusion du
verset natif après téléchargement des pages, avant préparation des textes,
prédiction ou lecture des scores. Aucun contenu de cette réserve n'a servi à cette
correction. Les deux gels et `pretest-hardening.json` conservent cette chronologie.

## Utilisation dans le générateur

L'option reste explicite et ne change pas les Bibles déjà générées :

```ts
await generateStrongLedger({
  // ... entrées et sorties explicites habituelles
  concordanceDisplay: "expressions",
  concordanceContext: true,
  concordanceRecovery: true,
  concordancePredicates: true,
  concordanceSurfaceRecovery: true,
  surfaceInflectionsPath: "<experiment>/french-inflections.json"
});
```

Le chemin et le contenu de l'index entrent dans l'empreinte de génération.
Le ledger conserve les attestations et la preuve par verset dans
`resolution.concordance.surface`. Aucun modèle n'est appelé ; aucune ressource
n'est publiée ou activée par ces scripts.

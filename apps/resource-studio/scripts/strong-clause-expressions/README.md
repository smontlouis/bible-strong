# Alignement local des expressions

Expérience locale du 3 octobre 2026, à partir des Bibles S21/NEG79 validées du
2 octobre. Les annotations et lemmes éditoriaux cibles restent côté évaluateur.
Aucun appel de modèle, aucune publication ni génération des neuf Bibles.

`strongClauseAlignment.ts` cherche un segment de un à quatre mots dans un contexte
court des témoins : mots fixes, ancre déjà placée, frontières de propositions,
adresse source native. `strongClauseLexicon.ts` fournit une preuve indépendante :
identité, flexion Kaikki, synset WOLF explicitement validé ou sens STEP/Kaikki.
La synonymie OpenOffice réciproque est une ablation séparée. Aucun synonyme ni
exception par référence biblique n'est codé pour réussir un exemple.

La politique sélectionnée sur le développement est `common-heads` : accord de
deux familles, emplacement unique, pas de nouveau partage d'un mot. Darby et
DarbyR constituent une famille. Les autres placements et relations restent
intacts. Les répétitions ambiguës, lectures non résolues, frontières incompatibles
et candidats concurrents conduisent à l'abstention. Aucun vide n'est créé.
Le segment de traduction complet reste distinct du mot choisi pour l'affichage.

Ce module traite des expressions locales ; il n'est pas un analyseur syntaxique
complet. Un score exact mesure un accord avec Concordance, pas une certification
sémantique. Les conventions d'affichage par édition sont comparées à l'affichage
commun. Les contrôles privés d'une seconde famille ne changent pas par construction.

## Ressources indépendantes

- `prepare-semantics.py` : OpenOffice et WOLF, avec POS et provenance de validation.
- `prepare-meaning-bridge.py` : sens STEP par identité exacte, suffixe et casse
  conservés ; sens anglais du dictionnaire français Kaikki. Retrait des citations
  bibliques STEP et des sens Kaikki qui ne décrivent qu'une flexion.
- Index de flexions repris de l'expérience précédente, sans Strong cible.

Les reçus conservent les empreintes des données originales et des index. Les sens
anglais restent séparés. Un partage de mots vagues ne suffit pas ; la négation
est conservée. Les liens des dictionnaires ne constituent pas des votes de Bibles.

## Rejeu

Depuis `apps/resource-studio`, le dossier préparé est
`outputs/strong-clause-expressions-2026-10-03`. Il contient les références
compressées, environnements autorisés, textes masqués et ressources indépendantes.
Les prédictions nouvelles sont des remplacements clairsemés liés au SHA du
baseline ; `evaluate.ts` les recompose avant de calculer les scores.

```sh
python3 scripts/strong-clause-expressions/run.py development --root <experiment>
# Une seule fois, avant d'acquérir une nouvelle réserve :
python3 scripts/strong-clause-expressions/freeze.py --root <experiment>
python3 scripts/strong-clause-expressions/verify-positive.py --root <experiment>
python3 scripts/strong-witness-recovery/acquire.py --root <experiment>
node --import tsx scripts/strong-witness-recovery/prepare.ts <experiment> test
python3 scripts/strong-clause-expressions/reserve.py --root <experiment>
python3 scripts/strong-clause-expressions/verify.py --root <experiment>
python3 scripts/strong-clause-expressions/report-data.py --root <experiment>
python3 scripts/strong-clause-expressions/strata.py --root <experiment>
```

Les étapes d'initialisation/acquisition/préparation n'écrasent pas un gel ou une
réserve déjà préparée. Pour rejouer une expérience terminée : `run.py test`, puis
`verify.py` et `report-data.py`. Si les sources courantes ont évolué, exécuter ces
scripts depuis le dossier `candidate-code` figé en donnant la racine absolue de
l'expérience. Le générateur baseline utilise son propre snapshot antérieur.

`verify.py` retire temporairement de leur emplacement attendu les pages, annotations
et scores, vérifie le générateur réel contre les prédictions pures, puis exige un
rejeu identique. Cette garde complète l'allowlist d'entrées et les empreintes ; elle
n'est pas un bac à sable de sécurité contre un code malveillant.
`verify-positive.py` choisit cinq versets de développement par édition par hash,
avec au moins un changement effectif, pour éviter une parité triviale sans gain.

## Générateur réel

L'option reste explicite ; elle préserve les Bibles déjà livrées :

```ts
await generateStrongLedger({
  // ... entrées/sorties habituelles explicites
  concordanceDisplay: "expressions",
  concordanceContext: true,
  concordanceRecovery: true,
  concordancePredicates: true,
  concordanceClauses: {
    inflectionsPath: "<experiment>/french-inflections.json",
    semanticsPath: "<experiment>/french-semantic-links.json.gz",
    meaningsPath: "<experiment>/independent-meaning-bridge.json.gz"
  }
});
```

La combinaison avec l'ancienne passe expérimentale `concordanceSurfaceRecovery`
est refusée car elle n'a pas été évaluée. Les preuves et ambiguïtés sont conservées
dans `resolution.concordance.clauses`, sans probabilité artificielle de correction.

## Décision de cette expérience

Le rapport `docs/strong-clause-expressions-results-2026-10-03.md` consigne la
non-promotion : +14 accords / 2 désaccords S21 et +4 / 1 NEG79 sur 232 versets
réservés. Les trois désaccords sont des limites d'expression trop courtes ; le F1
progresse mais le critère exact de précision fixé avant le test échoue. L'option
reste désactivée dans la livraison. Ne pas présenter un rejeu de cette réserve
exposée comme un nouveau test indépendant après une modification du moteur.

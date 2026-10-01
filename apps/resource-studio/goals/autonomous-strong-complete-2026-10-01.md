# Objectif de génération complète autonome des neuf Bibles françaises

État au checkpoint du 1er octobre : objectif non atteint, exécution en pause.
La priorité proposée pour la prochaine expérience est la reconstruction masquée
face à Concordance, Bible par Bible, avant de reprendre l'élargissement aux neuf
éditions. Voir le [checkpoint détaillé](../docs/strong-concordance-checkpoint-2026-10-01.md)
et le [prompt autonome](../docs/strong-concordance-night-experiment-prompt-2026-10-01.md).

La demande de Stéphane est de poursuivre jusqu’aux artefacts complets et vérifiés,
sans lui demander de revoir des versets ni de choisir les conventions. Les anciens
cycles d’expérimentation et leurs rapports ne constituent pas l’achèvement de ce
goal. Les anciennes prescriptions de revue humaine ou d’appels distants ne
s’appliquent pas à ce parcours déterministe local autorisé.

Cibles : NBS, BDS, BFC, FMAR, FRC97, NFC, NVS78P, OST, S21. La publication distante
et l’activation dans le service Resource sont hors périmètre.

## Critères de fin

- Les neuf éditions disposent de leur ledger SQLite intégral, avec le texte exact
  et toutes les références natives de l’entrée choisie.
- Chaque occurrence source modélisée est comptabilisée une fois, avec placement,
  vide lexical justifié ou incertitude motivée. L’ancrage et l’absence restent
  distincts ; la fonction grammaticale peut subsister sans porteur lexical.
- Les explorations déterministes sont conservées et les cas incertains ne
  deviennent pas une file de travail obligatoire pour l’utilisateur.
- Les exports lecteur/avancé, JSONL compact et preuves par verset sont générés et
  vérifiés. Les limitations de source, notamment les livres hors STEP, sont explicites.
- Le traitement reprend les seules éditions incomplètes ou périmées, avec contrôle
  des empreintes et conservation des tentatives antérieures.
- Les contrôles ciblés, évaluations masquées et vérifications de corpus sont
  terminés ; tout échec extérieur au périmètre est distingué et étayé.

## Parcours retenu

`src/strongAutonomous.ts` exécute le générateur canonique avec le dictionnaire
local vérifié `strong_lexicon.en-fr.full.production.sqlite`, puis les contrôles et
exports. Le dictionnaire par défaut historique est actuellement refusé par sa
propre attestation V3 ; ce garde-fou n’est pas désactivé.

`src/strongCanonicalResolution.ts` intègre la résolution et ses preuves au ledger.
Les positions utilisées pour le classement lexical sont conservées séparément des
nouveaux ancrages d’affichage. Les décisions déjà éditées sont protégées.

L’identité STEP distingue les collisions réelles de numéros de mots aux frontières
de versets (exemple Nombres 26.1 / 25.19). Les projections française et principale
ne doivent ni perdre une occurrence différente ni compter deux fois le même mot.

Les notes d’éditeur sont exclues des références d’alignement. Le détecteur de
correspondance compte les familles de témoins, accepte les coordonnées natives
dont le texte est un signe d’omission, et conserve une trace de ses choix.

La copie historique BFC avait 138 psaumes manquants. Les publications canoniques
locales du 1er octobre servent d’entrées complètes à BFC/FRC97/NFC. Leur canon de
73 livres est préservé, avec les livres hors du corpus STEP laissés sans Strong
inventés. Les six autres entrées sont textuellement identiques à leur publication
canonique locale. Aucun fichier d’entrée historique n’est écrasé.

## Exécution et reprise

Depuis `apps/resource-studio` :

```sh
STRONG_PERF=1 NODE_OPTIONS=--max-old-space-size=16384 \
  yarn exec tsx src/strongAutonomous.ts outputs/strong-autonomous/v2
```

`run.json` contient l’état de chaque Bible. Un redémarrage vérifie les fichiers et
les empreintes avant de réutiliser une édition achevée. Le code est archivé sous
`code/`, les entrées et leur provenance sous `inputs/`, les correspondances sous
`correspondence/`, et chaque tentative sous `<bible>/attempt-<n>/`.

Le premier répertoire `v1` et les pilotes sont des essais conservés. Le résultat
final doit être identifié à partir des éditions `verified` du run retenu, pas à
partir de la simple présence d'un fichier.

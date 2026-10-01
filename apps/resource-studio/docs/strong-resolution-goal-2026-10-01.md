# Goal : résolution explicable des occurrences Strong

Objectif approuvé : rendre compte de chaque occurrence source par un placement
français justifié, une absence d'équivalent explicite justifiée et ancrée, ou un
statut incertain. La preuve d'absence et la preuve d'ancrage sont indépendantes.

## Trois hypothèses maximum

1. **Provenance de la décision.** Distinguer dans le générateur un vide de
   complément automatique, un vide proposé par les témoins et une absence
   explicitement établie pour le texte cible. Un score de placement ou un échec
   lexical ne doit jamais être converti en certitude d'absence.
2. **Ancrage par les témoins.** Les voisins Strong identifiables dans les témoins
   peuvent fournir un intervalle d'insertion plus explicable qu'une règle de
   proportion. Désaccord, répétition ambiguë ou intervalle large restent visibles.
3. **Contrôle par l'ordre source.** Comparer cet intervalle aux occurrences source
   voisines déjà placées. Les inversions et désaccords produisent une incertitude,
   pas une moyenne des positions incompatibles.

Le corpus existant contient 240 références et trois éditions. Les textes sont
nettoyés des notes d'éditeur. Les 100 références de réserve restent exclues.
Aucun nouvel appel distant. Les labels de la Bible cible et de sa famille sont
exclus des entrées de chaque expérience masquée.

## Mesures

- Occurrences et versets avec décision visible, vide ou non résolue ; provenance
  de chaque décision et limites de son assurance.
- Accord avec les tags visibles/vides explicites des références, en séparant les
  absences de tag non évaluables. Cette mesure n'est pas une validation sémantique.
- Exactitude et couverture des ancrages, conditionnellement aux cas explicitement
  vides ; contradictions détectées et placements corrects perdus.
- Déterminisme, invariants d'identité et conservation du texte et des annotations.

Une proposition n'est pas une absence établie. Un contrôle automatisé peut vérifier
le contrat d'une décision revue ; il ne remplace pas la revue philologique. Aucun
chiffre de « verset certain » ne sera déduit de la simple couverture des Strong.

## Audit initial

`alignCompleteVerse` complète les occurrences non placées par des vides avec une
confiance fixe de 0,35. Leur ancrage prend le mot français le plus à droite parmi
les occurrences source antérieures. Ce sont des compléments de représentation.

`alignReaderVerse` exige un accord de familles de témoins sur des tags explicitement
vides, puis estime leur position par ratio de longueur. Darby et DarbyR comptent
déjà pour une seule famille. Cet accord ne vérifie pas à lui seul l'absence dans
une traduction cible différente ; le score unique ne distingue pas les deux preuves.

La méthodologie historique privilégiait le F1 du porteur. Le présent goal ajoute
les décisions d'absence et l'incertitude explicite, conformément à la clarification
de l'utilisateur, sans requalifier rétroactivement les anciens scores.

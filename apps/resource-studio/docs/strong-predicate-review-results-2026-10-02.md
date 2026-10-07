# S21 et NEG79 : prédicats et incertitudes visibles

Cette passe traite trois points : les expressions verbales, la prudence sur les
récupérations nominales et l'affichage des liens encore non résolus. La livraison
retenue est dans `outputs/strong-predicate-review-2026-10-02/recheck`.

**Le placement erroné de H3772 sur « alliance » en S21, 1 Rois 8.21, est retiré
du lecteur et classé comme incertain.** Le Strong G1392 porte désormais
« rendre gloire » dans Apocalypse 15.4. « Témoins » en 1 Jean 1.2 reste annoté,
avec la relation à « sommes témoins » conservée dans le dossier.

Le visualiseur indique les liens non résolus par verset. Un clic ouvre les
occurrences concernées et leurs motifs : expression à confirmer, lecture source,
correspondance de versets, groupe ou lien lexical non établi. Un cas non résolu
n'est pas présenté comme une absence de traduction.

## Choix de méthode

Le moteur reconnaît un nombre borné de constructions françaises avec copule ou
verbe-support. Il vérifie que l'extension ne traverse pas une ponctuation forte
et ne prend pas un mot déjà attribué à une autre occurrence. La relation complète
et le porteur visible restent distincts. Les choix d'affichage antérieurs sont
conservés ; l'élargissement visible est réservé aux nouvelles récupérations.

Une première ablation élargissait indistinctement les porteurs antérieurs. Elle
a été écartée sur le développement, car elle dégradait l'accord avec les
conventions existantes. Aucun synonyme ou numéro Strong propre à un exemple,
ni exception indexée par verset, n'a été ajouté.

La prudence nominale s'applique à une récupération verbale dont le mot se répète
ailleurs comme porteur d'une occurrence nominale. Sans construction suffisamment
établie, elle redevient incertaine. Le système ne fabrique pas de Strong vide.

## Contrôles indépendants et limites

La référence est la livraison précédente
`strong-witness-recovery-2026-10-02/final`. Les labels cibles sont réservés à
l'évaluateur. Le moteur, ses entrées et les programmes prédictifs sont figés
avant acquisition de la réserve. Aucun modèle local ou distant n'a été appelé.

Un premier test de 403 versets avait des scores de porteur stables. L'audit
intégral a cependant trouvé **19 relations S21 dont un complément antérieur
était perdu**, sans changement visible du lecteur. Cet essai est retiré et ses
chapitres sont devenus du développement. La correction conserve l'union de la
relation antérieure et du nouveau groupe, avec un test spécifique de non-régression.

Le développement final comprend 2 984 versets, plus les contrôles ciblés déjà
consultés. La nouvelle réserve comprend **460 versets dans 16 chapitres** :
Genèse 44, Nombres 29, 1 Samuel 13, Josué 15, Psaume 39, Job 35, Osée 5,
Ézéchiel 22, Luc 14, Matthieu 7, Actes 12 et 13, Hébreux 12, 3 Jean,
Apocalypse 8 et 21. Les chapitres déjà consultés sont exclus de cette sélection.

Le F1 exact mesure l'accord avec les annotations de Concordance.bible : même
Strong et mêmes mots porteurs, ou même ancrage vide. Il combine précision et
rappel ; ce n'est pas un pourcentage de justesse établi par expertise humaine.

| Scénario, 460 versets        | F1 exact avant | F1 exact après |
| ---------------------------- | -------------: | -------------: |
| S21, cible exclue            |       82,528 % |       82,528 % |
| NEG79, cible exclue          |       89,986 % |       89,986 % |
| S21, famille Segond exclue   |       76,583 % |       76,583 % |
| NEG79, famille Segond exclue |       81,954 % |       81,954 % |
| LSG, contrôle                |       83,606 % |       83,606 % |
| Darby, contrôle              |       83,787 % |       83,787 % |
| DarbyR, contrôle             |       83,233 % |       83,233 % |

**Aucun porteur ne change sur cette réserve.** Elle confirme une non-régression,
sans démontrer un gain indépendant de précision ou de couverture. Des relations
sont enrichies sans modifier leurs porteurs ; leur justesse complète n'est pas
certifiée par ces scores. Les gains observés sur les exemples de développement
ne doivent pas être présentés comme une nouvelle généralisation.

En cible exclue, la précision exacte est de 92,21 % pour S21 et 94,21 % pour
NEG79 ; le rappel est de 74,69 % et 86,12 %. Ces valeurs restent inchangées.
Les vides constituent toujours une limite majeure : sur cette réserve,
Concordance en compte 403 pour S21 et 324 pour NEG79, contre 4 et 7 dans nos
prédictions, sans accord exact d'ancrage. Cette passe ne résout pas cet écart
de convention et de preuve. L'échec d'une recherche reste une incertitude ;
la preuve d'absence et celle de l'ancrage doivent rester distinctes.

Sur les 2 984 versets de développement, S21 gagne trois accords exacts et
réduit de quatre les désaccords prédits : F1 de 83,374 % à 83,383 %. NEG79
reste à 90,843 %. L'affichage uniforme plus agressif (`common`) descend à
83,006 % et 90,488 %, puis à 82,323 % et 89,725 % sur la réserve. Le moteur
de relations commun est donc conservé avec les conventions d'affichage par
édition, sans assimiler tout écart de découpage à une erreur sémantique.

## Bilan complet

Les deux Bibles conservent leurs 31 169 versets, leurs textes exacts, leurs
441 653 unités source et leurs 465 909 identités de composantes. Aucun complément
d'une relation retenue n'est perdu dans la livraison finale.

| Mesure                                      |    S21 |  NEG79 |
| ------------------------------------------- | -----: | -----: |
| Versets dont l'affichage change             |     18 |      0 |
| Récupérations nominales mises à l'écart     |      6 |      0 |
| Liens incertains avant                      | 92 735 | 44 924 |
| Liens incertains après                      | 92 741 | 44 924 |
| Constructions avec copule consignées        |  5 017 |  6 371 |
| Constructions avec verbe-support consignées |  2 002 |  2 045 |

Ces constructions enregistrées ne sont pas autant de nouveaux Strong corrects.
Le bilan lecteur S21 comprend les six retraits et des extensions d'expressions.
Les 12 extensions visibles ont été relues : dix autour de « rendre / célébrer
la gloire », une sur « faites attention » et une sur « fit venir ». La revue
et ses limites sont consignées dans `assisted-review.json`, séparément des
prédictions. Aucun de ces jugements ne sert de règle particulière au moteur.

Les six retraits ont été examinés :

- 1 Rois 8.21 et 2 Chroniques 6.11 : le porteur nominal « alliance » ne suffit
  pas pour l'action exprimée par « conclue » ; ces deux placements étaient fautifs.
- 1 Rois 1.18 et Jérémie 22.11 : « devenu roi » est une reformulation plausible,
  mais la construction avec « devenir » n'est pas encore reconnue par cette
  règle. La mise en incertitude est conservatrice, pas une déclaration d'erreur.
- Jean 11.4 et 1 Pierre 4.11 : la gloire révélée ou reçue demande une relation
  verbale plus large. Le seul nom répété ne suffit pas à trancher dans cette passe.

Cette prudence a donc un coût en couverture. La reconnaissance de constructions
plus larges et des occurrences répétées reste un travail ultérieur ; il n'est
pas justifié de présenter toutes les annotations comme abouties.

## États visibles dans le lecteur

L'index de revue est séparé de l'index compact de lecture. Il est relié à la fois
à l'empreinte du JSONL et à celle du ledger. Une base de revue absente, corrompue
ou périmée affiche « Vérification indisponible ». Elle ne devient jamais un
compteur nul. Les vides établis sont comptés séparément et ne figurent pas dans
la liste des liens non résolus.

Les occurrences répétées conservent leurs identifiants distincts ; elles sont
présentées comme des cas séparés. Les statuts sont disponibles en mode Versets
et Lecture. Leur présence ne constitue pas une certification des autres porteurs.

Le chargement final a été vérifié dans le navigateur et par l'API locale.
`viewer-verification.json` confirme les empreintes des deux lecteurs et le
bilan des 62 338 fiches de revue. La capture `viewer-uncertainties.jpg` montre
la fiche de 1 Jean 1.2. Les deux candidates sont accessibles dans le
[visualiseur local](http://localhost:4173/viewer/?view=jsonl&versions=S21-CANDIDATE%2CNEG79-CANDIDATE&book=1John&chapter=1).

## Validation et reprise

Les tests ciblés couvrent les expressions, la conservation des compléments,
les conflits nominaux, la séparation visible/vide/incertain et les index périmés.
Le générateur intégré reproduit le moteur pur sur les sept scénarios. Le rejeu
avec les pages, labels et scores masqués garde les mêmes prédictions.

La suite compte 1 192 tests : 1 169 réussis, les mêmes 22 échecs de lexique
préexistants et un ignoré. Typecheck, ESLint ciblé, compilation avec `--rootDir .`,
contrôle de style et build du visualiseur passent. Le build standard du workspace
n'est pas déclaré réparé. React Doctor a également été exécuté.

Un manque d'espace a interrompu les exports auxiliaires après validation de la
transaction SQLite S21. La base complète a été contrôlée et son journal intégré,
puis les exports ont été reconstitués sans recalculer les prédictions. Les copies
d'entrées identiques ont été remplacées par des clones APFS à empreintes vérifiées ;
les sorties d'essais rejetés ont été compressées sans perte. Les reçus sont conservés.

Le [mode d'emploi](../scripts/strong-predicate-review/README.md) décrit les commandes
et les artefacts nécessaires au rejeu. Aucune publication, activation ou génération
des neuf Bibles n'a été effectuée. Les fichiers restent des candidates locales,
avec leurs limites désormais consultables dans le visualiseur.

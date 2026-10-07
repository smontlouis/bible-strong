# S21 et NEG79 : récupération par témoins, contexte et mots composés

La nouvelle passe récupère G3140 sur « témoins » en S21, 1 Jean 1.2, et G5547
sur « Jésus-Christ » dans les deux éditions. Les deux candidates complètes sont
reconstruites et contrôlées. **Le gain de rappel est réel sur le nouveau test,
mais modeste, et une erreur de porteur subsiste parmi les ajouts S21.**

La livraison retenue est dans `outputs/strong-witness-recovery-2026-10-02/final`.
Les sorties du dossier parent et de `recheck` sont retirées. Le point de référence
est la livraison du commit `c02b47005`, dans la branche d'expérience issue de
`dec602f8d`. Les modifications locales du visualiseur sont conservées. Aucun
modèle distant ou local n'a été appelé ; aucune ressource n'a été publiée.

## Ce qui change

Le moteur apprend des porteurs depuis les seuls témoins autorisés. La cible
annotée est exclue, et Darby/DarbyR sont comptés comme une seule famille. Une
occurrence encore sans porteur peut être récupérée si un mot unique et libre
est attesté dans au moins deux passages et deux familles, et se trouve entre
deux voisins lexicaux déjà placés. Les accents restent significatifs. Les
auxiliaires, mots grammaticaux et conflits entre nouvelles propositions sont
écartés. Les occurrences répétées ambiguës et les lectures alternatives restent
incertaines.

La règle des composés reconnaît deux éléments commençant par une majuscule et
séparés par un trait d'union. Une occurrence nominale déjà placée doit confirmer
un élément ; l'autre occurrence doit être proche dans la source et attestée
indépendamment. Le texte français reste identique, même quand le lecteur place
deux Strong sur le composé. Les porteurs déjà présents sont conservés.

Cette couche ne contient aucune règle propre à S21 ou NEG79, aucune table de
versets à réussir, ni correspondance Strong/mot écrite pour un exemple. Elle
reste opt-in avec `concordanceRecovery: true`. Elle ne crée pas de Strong vide.
Le choix d'affichage par édition des expériences précédentes reste en place.

## Réparation de NEG79

214 versets contenaient des jonctions suspectes entre une minuscule et une
majuscule. Une correspondance sur le texte complet d'un témoin, après retrait
des annotations et notes, confirme **168 espaces manquants dans 159 versets**.
Les 55 autres suspicions restent recensées sans correction conjecturale.

Seuls des espaces sont insérés. Les lettres, ponctuations et majuscules du texte
cible restent intactes. Retirer les espaces aux positions consignées restitue
exactement chaque texte initial. Les 31 010 autres entrées canoniques sont
identiques, présentation comprise. La nouvelle révision est
`neg79-1bc6c9c559277e6484fe` ; elle est validée au format canonique V4 et conserve
31 169 versets. L'ancienne publication n'est pas modifiée.

## Développement et réserves retirées

L'ablation sans contexte ajoute trop de désaccords. L'emploi de voisins réduit
fortement ces propositions. Une première réserve de 433 versets a ensuite
détecté des auxiliaires et des homographes grammaticaux ; une seconde réserve de
476 versets a signalé une réalisation implicite du nom « maison » dans « chez ».
Ces deux réserves ont été retirées avant de modifier le filtre. Elles font
désormais partie des **2 078 versets de développement**. 1 Jean 1 est également
un contrôle ciblé déjà consulté, distinct de ce décompte.

La version finale réutilise le filtre grammatical commun et le filtre des
auxiliaires du dépôt. Les règles et les programmes prédictifs ont été figés
avant l'acquisition de la troisième réserve : **503 versets dans 16 chapitres**.
La sélection par empreinte exclut tous les chapitres précédemment consultés et
couvre huit groupes de genres. Ce n'est pas un tirage uniforme de tous les
versets de la Bible, donc pas une estimation de la précision de la Bible entière.

Chapitres réservés : Lévitique 6, Exode 18, Josué 19, 1 Rois 8, Psaume 2,
Proverbes 7, Jérémie 11, Ésaïe 45, Luc 19, Jean 4, Actes 6 et 10, Romains 3,
Colossiens 3, Apocalypse 14 et 15.

## Résultats sur la réserve finale

Ces scores comparent la reconstruction aux annotations publiques, avec le même
texte masqué avant et après. Ils mesurent un accord éditorial avec Concordance,
pas une certification linguistique. La réparation du texte natif NEG79 est
contrôlée séparément et ne bénéficie pas artificiellement de ce dénominateur.

| Scénario                     | F1 exact avant | F1 exact après | Nouveaux accords exacts | Nouveaux désaccords |
| ---------------------------- | -------------: | -------------: | ----------------------: | ------------------: |
| S21, cible exclue            |       84,319 % |       84,443 % |                      16 |                   2 |
| NEG79, cible exclue          |       91,492 % |       91,515 % |                       3 |                   0 |
| S21, famille Segond exclue   |       78,825 % |       78,825 % |                       0 |                   0 |
| NEG79, famille Segond exclue |       83,642 % |       83,642 % |                       0 |                   0 |
| LSG, contrôle                |       84,871 % |       84,871 % |                       0 |                   0 |
| Darby, contrôle              |       85,310 % |       85,310 % |                       0 |                   0 |
| DarbyR, contrôle             |       84,511 % |       84,511 % |                       0 |                   0 |

Aucun placement auparavant exact n'est perdu. Les scénarios avec une seule
famille disponible restent inchangés par construction : les deux familles
requises manquent. Ils établissent une non-régression, pas une amélioration
indépendante de la famille Segond.

La précision exacte S21 passe de 93,058 % à 93,046 %, tandis que le rappel passe
de 77,081 % à 77,296 %. Pour NEG79, la précision passe de 95,208 % à 95,210 % et
le rappel de 88,056 % à 88,096 %. **On ne peut donc pas annoncer un gain général
de précision**, particulièrement pour S21.

Les deux désaccords nouveaux ont été examinés sans modifier les règles figées :

- **1 Rois 8.21, S21 : erreur de porteur.** H3772 est ajouté sur la seconde
  occurrence d'« alliance », alors que l'action est exprimée par « conclue ».
  Des attestations et des voisins corrects ne suffisent pas ici à choisir la
  tête du prédicat. L'erreur est conservée dans l'évaluation et reste une limite
  connue de la candidate ; aucune exception tirée de la réserve n'a été injectée.
- **Apocalypse 15.4, S21 : frontière d'expression.** G1392 est récupéré sur
  « gloire », tandis que la référence annote l'expression « rendre gloire ».
  Le contenu lexical est plausible, mais la relation complète reste à améliorer.

## Résultats sur les Bibles complètes

| Mesure                                    |     S21 |   NEG79 |
| ----------------------------------------- | ------: | ------: |
| Versets                                   |  31 169 |  31 169 |
| Nouvelles récupérations tracées           |     725 |     248 |
| Dont contexte lexical                     |     541 |      56 |
| Dont mots composés                        |     184 |     192 |
| Incertitudes avant                        |  93 460 |  45 254 |
| Incertitudes après                        |  92 735 |  44 924 |
| Part encore incertaine des unités source  | 21,00 % | 10,17 % |
| Versets sans incertitude ni alerte, avant |   4 010 |  13 272 |
| Versets sans incertitude ni alerte, après |   4 070 |  13 376 |

Les variations NEG79 comprennent également les effets de la réparation textuelle.
Les nombres de récupérations sont des décisions du système, pas des placements
tous certifiés. « Trompons » en S21, 1 Jean 1.8, reste explicitement incertain.

L'audit intégral conserve les 441 653 unités source et 465 909 identités de
composantes de chaque édition. Sur les textes inchangés, aucun porteur lecteur
antérieur n'est perdu et aucun changement ne sort de la récupération tracée.
Les seules différences de texte sont les 159 réparations NEG79 approuvées par
la règle de correspondance complète.

Une sélection déterministe de 18 ajouts couvre les deux règles et les testaments
disponibles. Dix-sept sont plausibles à partir du texte et de la source fournis.
Deutéronome 22.29, NEG79, demande encore une validation de groupe : l'étendue
temporelle rendue par « tant qu'il vivra » ne se résume pas à son seul mot porteur.
Ces jugements assistés ne sont pas une vérité indépendante.

## Validation et livraison

- Contrôles TypeScript du workspace et des scripts, ESLint ciblé et compilation
  avec `--rootDir .` réussis. Le build standard n'est pas déclaré réparé.
- 1 183 tests : 1 160 réussis, les mêmes 22 échecs de lexique préexistants, un ignoré.
- Parité entre le moteur pur et le générateur intégré dans les sept scénarios,
  sur les 503 versets : mêmes textes, porteurs, états et identités.
- Rejeu des sept scénarios avec pages, labels et scores masqués : prédictions
  identiques octet pour octet. La séparation des entrées ne prétend pas être
  un bac à sable du système d'exploitation.
- Relecture intégrale des deux SQLite et JSONL, vérification du texte, des
  inventaires et des ancrages ; validation du canonique NEG79 réparé.

Le [mode d'emploi](../scripts/strong-witness-recovery/README.md) donne les commandes
de rejeu. Le manifeste de livraison, les reçus, les ablations et les examens
des désaccords accompagnent les fichiers sous `final/`. Le visualiseur reçoit
les JSONL lecteurs de cette livraison, avec leurs index SQLite compacts.

La suite utile est une analyse explicite des groupes verbe/nom et des occurrences
répétées, puis des preuves de vides. Cette passe reste volontairement limitée :
elle améliore des cas concrets, sans rendre les deux Bibles prêtes à une
publication générale.

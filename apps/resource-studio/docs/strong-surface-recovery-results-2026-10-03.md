# Réexamen du moteur S21 / NEG79 — 3 octobre 2026

## Conclusion

Les essais trouvent des corrections locales utiles, mais **ne démontrent pas
encore de gain général sur des chapitres indépendants**. La passe finale ajoute
34 accords exacts S21 et 5 NEG79 sur les 3 789 versets de développement, sans
nouveau désaccord exact. Sur les **302 nouveaux versets de la réserve finale**,
elle ne modifie aucun placement. Elle reste donc expérimentale et désactivée
par défaut. Les Bibles du visualiseur conservent la livraison antérieure.

Le principal enseignement est que reconnaître un mot apparenté ne suffit pas à
établir quelle occurrence source il traduit dans la phrase. Le prochain chantier
le plus prometteur est l'alignement des propositions et des expressions complètes,
avec conservation des cas indécidables. Cette passe ne justifie pas à elle seule
une nouvelle génération intégrale des Bibles.

## Trois pistes testées

1. **Suffixes grammaticaux français** : reconnaître la base lexicale de formes
   comme « dit-il », « lève-toi » ou « jour-là », sans découper arbitrairement
   les mots composés et noms propres.
2. **Occurrences répétées** : autoriser une récupération lorsque les occurrences
   ont chacune un porteur unique, ordonné et délimité par des voisins déjà établis.
   Une ambiguïté sur le groupe bloque la récupération.
3. **Flexions attestées** : relier des formes conjuguées ou fléchies au même lemme
   à partir du dictionnaire français Kaikki local. Les données retenues contiennent
   uniquement les relations de flexion, pas les définitions anglaises ni des
   annotations Strong. Le lien au Strong vient des témoins autorisés.

Les associations lexicales sont apprises sans S21 ni NEG79. Darby et DarbyR
comptent comme une seule famille. Aucun synonyme propre à un exemple ni exception
indexée par verset ou numéro Strong n'a été ajouté. Aucun modèle, local ou distant,
n'a été appelé.

## Un premier essai rejeté

Une variante plus large associait parfois un verbe français à un Strong rencontré
dans un autre sens : « vouloir » pour un verbe de déclaration, ou « pris » dans
« pris la fuite » à partir d'autres emplois de « prendre ». Elle a été écartée
sur le développement. La règle suivante exigeait l'accord des deux familles
dans chacun de deux autres passages, en conservant les candidats concurrents
moins fortement attestés comme sources d'ambiguïté.

Sur une première réserve de **345 versets**, cette variante ajoutait quatre
accords exacts S21 et un désaccord. Le désaccord était substantiel : en
**Nombres 16.35**, H3318 était proposé sur « venu » dans « un feu jaillit, venu
de l'Éternel », alors que le porteur attendu était « jaillit ». La proximité
lexicale n'établissait pas la bonne relation dans cette phrase.

L'essai a été retiré et ses 345 versets sont devenus du développement. La correction
interdit de traverser une virgule, en plus des autres frontières fortes. Cette
prudence retire aussi des possibilités légitimes ; elle ne prouve aucune absence.

Un second garde-fou exige que l'identité Strong soit corroborée par les deux
familles dans le verset source natif. Les divergences de numérotation rencontrées
notamment sur les verbes grecs ne sont pas résolues par simple ressemblance des
formes françaises. Elles restent incertaines.

## Réserve finale et indépendance

Le jeu final réserve douze chapitres : Deutéronome 25, Nombres 8, 2 Rois 18,
2 Chroniques 15, Proverbes 6, Psaume 54, Amos 4, Jérémie 24, Luc 11,
Matthieu 10, Hébreux 2 et Jacques 5. Les chapitres exposés dans les expériences
précédentes et les pages déjà acquises ont été exclus avant sélection.

Les réserves par chapitre d'Actes et d'Apocalypse sont épuisées dans cette
conversation : ces livres restent dans les contrôles de développement et ne
constituent pas une nouvelle validation indépendante de cette passe.

Une revue de code a ensuite renforcé l'exclusion des attestations du verset natif
quand son adresse diffère de l'adresse cible. Elle a eu lieu après téléchargement
des pages, **avant préparation des textes réservés, prédiction ou lecture des
scores**, à partir du code et des références de développement. Aucun contenu de
la nouvelle réserve n'a servi à cette correction. Les deux gels et le reçu
`pretest-hardening.json` conservent cette chronologie ; il ne faut pas prétendre
que le dernier gel précédait le téléchargement des pages.

## Mesures avant / après

Le F1 exact combine précision et rappel de l'accord avec Concordance.bible,
sur les mêmes identifiants et porteurs. Ce n'est pas un taux de justesse établi
par expertise humaine. Les chiffres de réserves différentes ne doivent pas être
comparés comme s'ils mesuraient un progrès du moteur.

| Réserve finale : 302 versets par scénario | F1 exact avant | F1 exact après |
| ----------------------------------------- | -------------: | -------------: |
| S21, cible exclue                         |       84,473 % |       84,473 % |
| NEG79, cible exclue                       |       91,734 % |       91,734 % |
| S21, famille Segond exclue                |       79,274 % |       79,274 % |
| NEG79, famille Segond exclue              |       83,932 % |       83,932 % |
| LSG, contrôle                             |       85,494 % |       85,494 % |
| Darby, contrôle                           |       86,293 % |       86,293 % |
| DarbyR, contrôle                          |       86,066 % |       86,066 % |

| Développement : 3 789 versets | Nouveaux accords exacts | Nouveaux désaccords | F1 avant | F1 après |
| ----------------------------- | ----------------------: | ------------------: | -------: | -------: |
| S21, cible exclue             |                      34 |                   0 | 83,231 % | 83,270 % |
| NEG79, cible exclue           |                       5 |                   0 | 90,580 % | 90,585 % |

Les contrôles et scénarios sans la famille Segond ne changent pas. La nouvelle
passe exige deux familles et n'intervient donc pas dans les scénarios où une seule
famille subsiste. Leur stabilité ne démontre pas une amélioration hors de cette
proximité éditoriale.

Le moteur commun a été comparé aux conventions d'affichage par édition : la
politique prudente avec porteur lexical commun et celle conservant ces conventions
produisent les mêmes scores sur le développement et la réserve. Aucun besoin
nouveau d'une règle propre à S21 ou NEG79 n'est démontré.

`comparison-summary.json` conserve aussi précision/rappel exacts et chevauchants,
identité, cardinalité, vides, ancrages, taux d'incertitude, versets entièrement
comptabilisés, ainsi que les ventilations AT/NT et par difficulté. Les classes de
difficulté peuvent se recouvrir. Aucun vide ni ancrage n'a été ajouté ou modifié.

## Code et validation

Le moteur pur se trouve dans `strongSurfaceRecovery.ts`, l'index de flexions et
les inventaires de témoins dans `strongInflectionEvidence.ts`. L'intégration au
générateur est explicite avec `concordanceSurfaceRecovery` et
`surfaceInflectionsPath` ; l'index et le code participent à l'empreinte. Les preuves
sont conservées dans le dossier d'occurrence, séparément du porteur visible.

Les tests ciblés vérifient notamment la conservation des placements antérieurs,
les répétitions, accents, lemmes ambigus, concurrents, ponctuation, familles corrélées,
identités non corroborées et exclusions des références cible et native. Les règles
ne convertissent jamais une recherche infructueuse en Strong vide.

Les sept scénarios ont été rejoués avec les pages, annotations et scores masqués.
Le générateur réel est comparé à la passe pure, sur la réserve et sur des cas
de développement où la nouvelle option agit effectivement. Les résultats détaillés
sont dans `integration-verification.json`, `blind-replay-verification.json` et
`positive-integration-verification.json`.

Typecheck, ESLint ciblé et compilation avec `--rootDir .` sont contrôlés. Les
22 échecs de lexique préexistants sont suivis séparément dans `test-comparison.json`.
Le build standard du workspace n'est pas annoncé réparé.

La suite finale compte **1 208 tests : 1 185 réussis, 22 échecs préexistants
inchangés et un ignoré**. Les 36 tests ciblés réussissent. Les contrôles positifs
du générateur produisent sept ajouts S21 et cinq NEG79 sur cinq passages connus
par édition, avec parité exacte de la passe pure ; ce sont des contrôles
d'intégration, pas une réserve indépendante supplémentaire.

## Recommandation

Conserver la passe comme expérimentation rejouable. Un prochain cycle devrait
aligner les groupes de mots et les propositions avant de choisir le porteur,
notamment quand un mot français représente plusieurs éléments sources ou qu'une
reformulation change la classe grammaticale. Les flexions et les ancrages proches
ne suffisent pas à traiter ces cas. Les preuves de vrais vides et de leur position
restent un chantier séparé.

Les Bibles complètes, leurs index de lecture et de revue n'ont pas été remplacés.
Les sorties de recherche sont compressées, les copies d'exécution retirées après
vérification de leurs sources, et les fichiers identiques partagés par clones APFS
à inodes indépendants. Le [mode d'emploi](../scripts/strong-surface-recovery/README.md)
explique le rejeu ; le dossier retenu est
`outputs/strong-surface-recovery-2026-10-02/recheck`. Aucune publication ni activation
de ressource n'a été effectuée.

# Reconstruction Strong S21 et NEG79 — expérience du 1er octobre 2026

Cette expérience mesure la reconstruction d’annotations masquées et distingue
l’accord éditorial, la résolution des occurrences et la justification des vides.
Le code reste expérimental. Aucune publication, activation ou génération des neuf
Bibles n’a été effectuée ; aucun modèle distant ou local n’a été appelé.

## Périmètre et données

Le contrôle externe a été réellement acquis : pages publiques **SG21 = Segond 21
2007**, avec attribution des Strong en 2026, et **NEG = Nouvelle Édition de Genève,
révision 1979**. Le site décrit NEG comme une révision légère de Louis Segond.
Les balises `data-pa` donnent le numéro d’occurrence et le Strong ; `data-ns`
confirme la présence d’annotations. La reconstruction ne dépend pas du simple
bouton d’affichage des Strong. [Caractéristiques des éditions](https://concordance.bible/pages/bibles/)

Les 34 pages du corpus final représentent **918 textes d’édition**, soit
**261 versets de développement et 198 versets réservés par édition**.
Les neuf chapitres de développement sont Exode 10 et 37, 1 Samuel 19, Psaume 114,
Proverbes 8, Ésaïe 21, Luc 22, Romains 2 et Apocalypse 13. La réserve finale est
Exode 20, 1 Samuel 23, Psaume 31, Proverbes 27, Ésaïe 35, Luc 17, Romains 16 et
Apocalypse 17. Elle couvre huit genres, AT et NT. LSG, Darby et DarbyR sont
reconstruits sur les mêmes chapitres pour les contrôles.

La sélection est déterministe, par empreinte de chapitre, après exclusion des
chapitres déjà utilisés dans les expériences précédentes. Exode 10, explicitement
connu dès le protocole, appartient au développement. Toutes les pages, dates,
empreintes et attributions sont conservées dans le cache local. Aucun export
annoté public n’a été identifié dans les pages examinées : l’acquisition est
limitée au plan, à débit modéré. Les textes intégraux restent ignorés par Git.

Le site emploie la numérotation BHS/NA ; le banc utilise ses références et son
texte, sans supposer l’identité avec une autre publication locale de S21.
Les notes d’éditeur, titres et boutons sont exclus, les lignes poétiques
continuées sont conservées. Une occurrence portant plusieurs mots est groupée par
`data-pa` ; deux occurrences avec le même Strong restent distinctes, et les
relations discontinues conservent leurs ensembles de mots.
[Versification du site](https://concordance.bible/pages/versification/)

Deux erreurs d’import ont été détectées et corrigées : omission initiale des
continuations poétiques, puis inclusion de titres et de navigation. **Les chiffres
antérieurs ne sont pas les résultats finaux.** La première réserve a été retirée
après son inspection. Une nouvelle réserve a été acquise ; les empreintes prouvent
que les règles du moteur n’ont pas changé. L’import final vérifie la conservation
de chaque élément `<w>`, refuse le texte lexical inattendu hors de ces éléments,
et ne produit aucune concaténation alphabétique accidentelle entre deux mots.

## Ce qui est aveugle, et ce qui ne l’est pas

Le moteur reçoit seulement le texte cible et ses références. Les lemmes, Strong,
positions de vides et identifiants cibles restent dans `evaluator-only/`.
L’évaluation est exécutée après écriture et empreinte des prédictions, dans un autre
processus. Les corrections historiques, sorties de modèles et caches lexicaux
préexistants sont exclus. Les lexiques de témoins et les limites d’expression
sont reconstruits à partir de la liste explicite de témoins autorisés.

L’audit du dictionnaire français historique a retrouvé 22 717 traductions,
une attribution STEP et des métadonnées de release, mais pas une attestation par
candidat excluant l’exposition aux annotations S21/NEG. **Il n’est donc pas utilisé
pour la conclusion aveugle.** Un dictionnaire neutre fournit exactement zéro
candidat au code initial ; aucun contrôle d’attestation V3 n’est supprimé.
Les scores ne sont pas directement comparables aux anciens canaries qui utilisaient
ce dictionnaire et d’autres échantillons.

Deux scénarios sont séparés :

- **Cible exclue** : S21 et NEG ne contribuent jamais ; LSG, Darby et DarbyR restent
  disponibles. La proximité NEG/LSG explique une partie de la facilité de ce scénario.
- **Famille proche exclue** : LSG est également retirée. Darby/DarbyR représentent
  une seule famille, avec deux formulations corrélées. Pour contrôler Darby ou
  DarbyR, les deux éditions sont retirées ensemble ; seul LSG reste témoin.

Les témoins peuvent couvrir les chapitres évalués : c’est un transfert vers une
édition masquée, pas une traduction sans témoins. La séparation des chapitres
protège le réglage des règles ; elle ne crée pas une autorité sémantique indépendante.
Concordance indique que ses annotations sont d’abord affectées automatiquement,
puis corrigées humainement. Notre score mesure donc un accord éditorial avec une
référence qui peut elle-même contenir des erreurs. [FAQ](https://concordance.bible/pages/faq/)

## Trois règles comparées

1. **Nombres** : une valeur cardinale STEP explicite peut porter un chiffre français
   lorsque identité, nombre d’occurrences, ordre et nom voisin déjà placé sont
   compatibles. Variantes, collisions, ambiguïtés et correspondances de simples
   composants sont refusées. Les conversions d’unités et les groupes numériques
   complexes ne sont pas résolus par cette règle.
2. **Limites d’affichage** : le moteur initial pouvait afficher tout un groupe de
   contexte appris. Le candidat apprend les porteurs réellement balisés dans les
   témoins et exige trois couples famille/verset cohérents pour une forme apprise.
   Un porteur simple unique des témoins du même verset peut aussi justifier le
   resserrement local. La relation complète est conservée séparément du mot
   d’affichage. Un resserrement peut néanmoins diverger
   de la convention d’une locution telle qu’« en effet ».
3. **Résolution explicite** : un porteur sans propriétaire source résolu est retiré
   de la projection affirmative, et reste documenté comme incertain. Les vides
   hérités des témoins ne prouvent pas une absence dans la cible. Seuls les vides
   déjà établis par la règle grammaticale H0853/HTo sont affichés avec leur ancrage
   distinct ; un échec de recherche ne devient jamais une absence.

`carriers-only` combine les deux premières règles et isole le gain de placement.
`combined`, sélectionné avant la réserve, ajoute la troisième et suit la priorité
produit. Les résultats de cette dernière ne doivent pas être présentés comme une
hausse générale du F1 : l’incertitude explicite a aussi un coût en rappel.

Les profils initiaux S21, NEG79 et NBS ont les mêmes paramètres d’alignement.
L’adaptation réellement testée impose deux familles pour resserrer une expression
S21 et réserve les chiffres à S21. Aucune règle particulière à un verset et aucun
synonyme ad hoc n’a été introduit. Laya n’a pas été exécuté : son utilité n’est
pas évaluée dans ce cycle et aucune intégration n’en dépend.

## Résultats vérifiés sur la réserve finale

Les pourcentages ci-dessous sont **précision / rappel / F1 du porteur exact**, sur 198 versets par ligne. Le corpus final et les règles étaient figés avant cette évaluation. Les résultats retirés de la première réserve ne sont pas mélangés à ceux-ci.

| Édition et scénario    |               Initial | Nombres + limites (`carriers-only`) | Résolution explicite (`combined`) |
| ---------------------- | --------------------: | ----------------------------------: | --------------------------------: |
| S21 · cible exclue     | 92,23 / 80,74 / 86,11 |               92,58 / 81,04 / 86,43 |             93,69 / 74,62 / 83,08 |
| S21 · famille exclue   | 91,30 / 70,17 / 79,35 |               91,89 / 70,62 / 79,86 |             92,85 / 65,67 / 76,93 |
| NEG79 · cible exclue   | 94,61 / 91,91 / 93,24 |               94,61 / 91,91 / 93,24 |             95,29 / 84,54 / 89,60 |
| NEG79 · famille exclue | 91,71 / 75,24 / 82,66 |               92,22 / 75,66 / 83,12 |             93,06 / 70,30 / 80,10 |

**Le gain de placement est modeste et réel sur S21, mais le mode de résolution explicite perd du rappel.** Avec LSG disponible, les limites apportent 11 nouveaux porteurs exacts S21 et en perdent 3, soit +8 nets. Sans la famille Segond, le gain est de 15 avec les mêmes 3 pertes, soit +12 nets. NEG79 gagne 11 porteurs sans LSG et ne change pas avec LSG. Aucune décision numérique nouvelle n’est ajoutée sur cette réserve : le gain des nombres observé au développement n’est donc pas confirmé hors développement.

Les trois pertes S21 concernent G1063 en Luc 17.21, Luc 17.24 et Apocalypse 17.17 : l’affichage est resserré d’« en effet » sur « effet ». La relation complète demeure enregistrée, mais cela reste une régression d’accord exact avec Concordance. **Il serait faux d’annoncer zéro régression S21.**

La projection `combined` retire en outre des porteurs que la référence juge exacts mais dont notre modèle source n’établit pas la relation. Sur S21 avec LSG, elle gagne 11 porteurs exacts et en perd 173 ; la précision passe de 92,23 % à 93,69 %, mais le rappel de 80,74 % à 74,62 %. Cette prudence ne constitue pas une amélioration globale de F1 ni une validation sémantique indépendante.

### Effet séparé des règles

Sur le développement, les cellules donnent les variations **TP / FP exacts** par rapport au code initial. Elles ne sont pas des jugements indépendants sur la justesse sémantique.

| Scénario               |  Nombres |   Limites | Résolution explicite seule | F1 initial | F1 nombres + limites |
| ---------------------- | -------: | --------: | -------------------------: | ---------: | -------------------: |
| S21 · cible exclue     | +11 / +3 |   +5 / -5 |                 -149 / -42 |      84,28 |                84,58 |
| S21 · famille exclue   | +10 / +3 | +19 / -19 |                 -107 / -22 |      77,85 |                78,61 |
| NEG79 · cible exclue   |  +0 / +0 |   +1 / -1 |                 -157 / -28 |      92,81 |                92,84 |
| NEG79 · famille exclue |  +0 / +0 | +20 / -20 |                 -107 / -21 |      83,76 |                84,37 |

Les trois désaccords numériques de développement S21 sont expliqués dans les dossiers : Exode 37.21 et 37.27 portent chez Concordance des occurrences numériques sur des mots comme « autres », « mit » ou « les ». La valeur source et le nom voisin rendent notre chiffre plausible ; ce jugement assisté n’est pas une preuve de supériorité. Les variantes individuelles, leur combinaison et tous les compteurs sont conservés dans `evaluation/` et `all-metrics.tsv`.

| Réserve : F1 exact     | Initial | Nombres | Limites | Résolution seule | Combinaison | Adaptation par édition |
| ---------------------- | ------: | ------: | ------: | ---------------: | ----------: | ---------------------: |
| S21 · cible exclue     |   86,11 |   86,11 |   86,43 |            82,74 |       83,08 |                  82,95 |
| S21 · famille exclue   |   79,35 |   79,35 |   79,86 |            76,40 |       76,93 |                  76,40 |
| NEG79 · cible exclue   |   93,24 |   93,24 |   93,24 |            89,60 |       89,60 |                  89,60 |
| NEG79 · famille exclue |   82,66 |   82,66 |   83,12 |            79,62 |       80,10 |                  80,10 |

L’adaptation testée pour S21 est moins bonne que le moteur commun dans les deux scénarios. Le filtre exigeant deux familles désactive notamment les corrections quand seule la famille Darby est disponible. Il n’y a pas ici de preuve en faveur de règles particulières par édition ; le bénéfice principal de NEG79 provient de sa proximité avec LSG.

### AT, NT et difficultés

| Édition et scénario    | Testament · versets | F1 initial → combinaison |   P / R final | F1 chevauchant final |
| ---------------------- | ------------------- | -----------------------: | ------------: | -------------------: |
| S21 · cible exclue     | AT · 116            |            86,22 → 84,63 | 92,84 / 77,76 |                85,50 |
| S21 · cible exclue     | NT · 82             |            86,01 → 81,63 | 94,54 / 71,82 |                82,52 |
| S21 · famille exclue   | AT · 116            |            78,18 → 76,97 | 91,70 / 66,32 |                78,18 |
| S21 · famille exclue   | NT · 82             |            80,39 → 76,89 | 93,91 / 65,09 |                77,90 |
| NEG79 · cible exclue   | AT · 116            |            95,53 → 92,92 | 95,84 / 90,17 |                93,66 |
| NEG79 · cible exclue   | NT · 82             |            91,14 → 86,42 | 94,74 / 79,45 |                87,76 |
| NEG79 · famille exclue | AT · 116            |            82,07 → 80,13 | 92,38 / 70,74 |                81,03 |
| NEG79 · famille exclue | NT · 82             |            83,19 → 80,07 | 93,70 / 69,90 |                81,48 |

Pour S21, cible exclue, les difficultés ci-dessous sont définies par les annotations de référence et la structure STEP. Elles se chevauchent ; leurs effectifs ne s’additionnent pas.

| Difficulté             | Versets | F1 initial | F1 combinaison | Incertitude finale |
| ---------------------- | ------: | ---------: | -------------: | -----------------: |
| vides                  |      81 |      83,17 |          79,57 |            25,83 % |
| variantes-source       |      60 |      85,70 |          79,23 |            33,13 % |
| repetitions            |     118 |      85,42 |          81,91 |            23,10 % |
| expressions            |      24 |      82,15 |          77,38 |            25,79 % |
| relations-discontinues |       3 |      85,98 |          85,98 |             8,93 % |

Les mêmes répartitions existent pour les autres éditions, scénarios et genres dans les JSON et le TSV complet : 112 synthèses et 13 184 lignes de mesures.

### Inventaire, incertitude, identité et vides

| Scénario               | Unités source |    Incertains | Vides établis | Versets entièrement comptabilisés | Versets avec identité externe comparable |
| ---------------------- | ------------: | ------------: | ------------: | --------------------------------: | ---------------------------------------: |
| S21 · cible exclue     |          2715 | 611 · 22,50 % |             7 |                            25/198 |                                   85/198 |
| S21 · famille exclue   |          2715 | 847 · 31,20 % |             4 |                             9/198 |                                   85/198 |
| NEG79 · cible exclue   |          2715 | 382 · 14,07 % |             9 |                            80/198 |                                   86/198 |
| NEG79 · famille exclue |          2715 | 730 · 26,89 % |             5 |                            16/198 |                                   86/198 |

Ces compteurs sont structurels : un verset entièrement comptabilisé peut encore avoir un mauvais porteur. Aucune augmentation de couverture complète ou diminution d’incertitude n’est démontrée sur la réserve finale. Les unités sont celles du modèle Strong STEP ; elles ne représentent pas tous les morphèmes des langues originales.

L’identité externe est évaluée seulement lorsque toute la séquence d’ordinaux et de Strong est compatible, unique et sans lecture non résolue. Cela ne concerne que 4 versets NT S21 et 5 NT NEG dans cette réserve. Les autres versets restent dans le score de porteur, mais **aucune validation complète des identités répétées n’est revendiquée**.

| Identité source + porteur exact · sous-ensemble comparable |    P / R / F1 initial | P / R / F1 combinaison |
| ---------------------------------------------------------- | --------------------: | ---------------------: |
| S21 · cible exclue                                         | 92,98 / 81,34 / 86,77 |  93,27 / 81,92 / 87,23 |
| S21 · famille exclue                                       | 91,49 / 68,48 / 78,33 |  92,28 / 69,29 / 79,15 |
| NEG79 · cible exclue                                       | 96,56 / 95,25 / 95,90 |  96,00 / 95,14 / 95,57 |
| NEG79 · famille exclue                                     | 92,86 / 75,00 / 82,98 |  93,31 / 75,68 / 83,57 |

| Scénario · combinaison | F1 inventaire | Erreur absolue de cardinalité | Versets à cardinalité exacte | Vides prédits / attendus | Même Strong vide / même ancre |
| ---------------------- | ------------: | ----------------------------: | ---------------------------: | -----------------------: | ----------------------------: |
| S21 · cible exclue     |         87,79 |                           581 |                       27/198 |                  7 / 125 |                         0 / 0 |
| S21 · famille exclue   |         82,11 |                           809 |                       11/198 |                  4 / 125 |                         0 / 0 |
| NEG79 · cible exclue   |         92,82 |                           357 |                       88/198 |                   9 / 93 |                         0 / 0 |
| NEG79 · famille exclue |         84,98 |                           694 |                       18/198 |                   5 / 93 |                         0 / 0 |

La référence initiale S21 avec LSG affichait 32 vides : 29 avaient un Strong vide correspondant et 17 le même ancrage. La combinaison retire ces affirmations insuffisamment établies et affiche 7 vides grammaticaux H0853. Aucun n’a de vide H0853 correspondant dans Concordance. Leur justification vient de la règle linguistique bornée, et leur emplacement d’une convention distincte sur les porteurs voisins. **Ni leur absence ni leur ancrage ne sont validés indépendamment par ce benchmark.** Un F1 d’inventaire élevé n’est jamais présenté comme une précision sémantique.

### Contrôles LSG, Darby et DarbyR

| Témoin masqué · famille exclue | F1 initial | F1 nombres + limites | Porteurs exacts gagnés / perdus | F1 résolution explicite |
| ------------------------------ | ---------: | -------------------: | ------------------------------: | ----------------------: |
| LSG                            |      84,25 |                84,71 |                          11 / 0 |                   81,50 |
| Darby                          |      83,63 |                85,78 |                          53 / 0 |                   82,81 |
| DarbyR                         |      83,48 |                85,40 |                          47 / 0 |                   82,34 |

Les règles de placement gagnent respectivement 11, 53 et 47 porteurs exacts sans en perdre sur ces contrôles. La projection de résolution explicite baisse néanmoins leur rappel aussi : elle n’est pas qualifiée de non régressive par rapport au lecteur initial.

## Désaccords examinés et limites sémantiques

Un échantillon déterministe et stratifié de **32 dossiers** a été examiné avec texte cible, source STEP et témoins autorisés : deux désaccords par ensemble × édition × scénario × testament. Les 12 alertes de correspondance textuelle ont également été examinées. Ce sont des jugements assistés, exposés, sans adjudication humaine ou indépendante ; aucun n’a été réinjecté dans les prédictions gelées.

- **Mauvais porteur réel** : S21 Romains 2.1, G4238, reste sur « comme » alors que le prédicat est « agis ». De même, 1 Samuel 23.21 place H3588 sur le « Que » du souhait au lieu de la liaison causale « pour ». La résolution source seule ne garantit donc pas la justesse du mot français.
- **Mauvaise répétition** : NEG Romains 2.10 place l’article G3588 du groupe « le bien » sur celui de « le Juif ». Le même numéro et le même mot ne suffisent pas. En 1 Samuel 23.20, l’infinitif et l’impératif de descendre sont encore mal départagés.
- **Reformulations et clitiques** : faute/iniquité, serviteur/esclave, pronoms fusionnés et groupes tels que « se concertent » laissent des incertitudes. Un nom lexical absent peut garder son sens dans une construction ; ces cas ne sont pas automatiquement transformés en vides.
- **Référence discutable** : NEG 1 Samuel 19.4 marque vide un verbe que « commis » paraît réaliser ; 1 Samuel 19.11 porte le Strong de vie sur « cette ». Ces observations motivent une réserve sur l’oracle éditorial, pas une déclaration « meilleur que Concordance ».
- **Filtre de variantes trop large** : le modèle hérité considère tout type différent de L/NKO comme une lecture incertaine. Les légendes STEP distinguent pourtant des variantes mineures sans changement de sens, dont L(p), et des différences NT N(k)O parfois sans effet sur la traduction. Exode 20 perd ainsi des porteurs pourtant évidents comme eaux. Ce défaut explique une part du rappel perdu ; il n’a pas été corrigé après consultation de la réserve.
- **Découpage vérifié** : aucune des 12 alertes lexicales ne justifie une exclusion de verset après examen. Dans le Psaume 31, la source porte explicitement des références alternatives, par exemple `Psa.31.10(31.11)` ; la projection ne confond pas un décalage documenté avec une erreur de mot. Zéro verset a été exclu de la comparaison éditoriale ; les limites d’identité sont comptées séparément.

Les 6 204 désaccords de l’ensemble des scénarios sont aussi triés mécaniquement. Ce nombre répète certains passages entre scénarios ; il n’est pas un effectif indépendant. La catégorie automatique « variante-source » peut englober une autre occurrence du même Strong : les dossiers expliquent ces distinctions au lieu de prendre le tri pour une adjudication.

## Validation et recommandation

- **Reproductibilité** : 98 fichiers d’entrée revérifiés ; archive initiale contrôlée ; sortie initiale identique après retrait des emplacements de pages et d’annotations cibles ; candidat rejoué à empreinte identique. Les tests vérifient aussi que modifier des identifiants, lemmes ou ancrages cible ne change pas le texte masqué. La séparation est celle des entrées et processus contrôlés, pas une sandbox contre du code malveillant.
- **Tests nouveaux** : 16 tests TypeScript et 9 tests Python d’acquisition réussis. Les 39 tests TypeScript des autres outils d’expérience et les 8 tests Python eflomal/Laya/JEV réussissent, sans appeler de modèle. Le premier essai avec le Python système ne trouvait pas eflomal ; les environnements locaux existants ont ensuite exécuté ces contrats.
- **Suite complète** : 1 127 tests, 1 104 réussis, 22 échecs, 1 ignoré. L’état initial avait 1 111 tests, 1 088 réussis et les mêmes 22 échecs. La comparaison conserve les mêmes fiches de panne de lexique V3 et l’échec parent associé : aucune nouvelle régression logicielle.
- **Compilation** : typecheck du workspace, TypeScript strict du banc, émission JavaScript du périmètre et ESLint réussis. Le build standard conserve ses 6 erreurs TS6059 préexistantes d’imports de scripts hors de `rootDir: src`. Ce build global n’est pas annoncé comme réussi.

**Recommandation : conserver un moteur commun et le banc aveugle, sans promouvoir automatiquement l’ensemble du candidat.** Les limites apprises sont utiles sur LSG/Darby/DarbyR et modestement utiles sur S21, mais les locutions S21 doivent être protégées avant une adoption générale. Le gain des chiffres nécessite une autre réserve contenant des cas effectivement déclenchés. NEG79 ne justifie pas de règle propre à l’édition dans cette expérience.

La priorité suivante est commune : distinguer variantes mineures et véritables changements de lecture, mieux représenter les relations plusieurs-à-plusieurs, et désambiguïser les occurrences répétées par leurs constructions locales. Un dictionnaire français n’aidera l’évaluation aveugle qu’avec une provenance auditable. La réserve finale est désormais consommée ; toute nouvelle amélioration devra être mesurée sur d’autres chapitres. Les résultats actuels ne justifient ni la certification des neuf Bibles ni leur régénération immédiate.

## Rejeu et provenance du travail

Le [mode d’emploi](../scripts/strong-concordance-night/README.md) décrit acquisition,
préparation, référence initiale, comparaisons, gel, réserve et vérification. Les
mesures détaillées par édition, scénario, testament, genre et difficulté, les
prédictions et chaque changement sont dans
`outputs/strong-concordance-night/final-v2/`. Le code initial est archivé depuis
`dec602f8db67f94476f7f50a4289de5c405640a1` ; le moteur expérimental ne remplace pas
les commandes de génération de production.

Le dépôt partagé demandé a été basculé extérieurement sur `master`, après un commit
de version Expo `cea5763e0`. Ces changements ont été préservés. Le code de
l’expérience a été déplacé, à empreintes identiques, dans le worktree propre de
cette tâche, issu du même checkpoint, sur
`codex/strong-concordance-night-verified-2026-10-01`. Les données restent à
l’emplacement demandé dans le dépôt initial, accessibles depuis le worktree.

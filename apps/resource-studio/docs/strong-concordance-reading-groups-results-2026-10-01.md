# Strong : variantes mineures, expressions et identités — 1er octobre 2026

Le nouveau test confirme un gain modeste de placement et de rappel sur S21 et NEG79, avec moins d’incertitudes artificielles. **La politique sélectionnée ne perd aucun porteur auparavant exact dans les sept scénarios réservés. Elle introduit néanmoins quelques propositions incorrectes ou des désaccords de limites**, tous examinés. La correction des articles répétés fonctionne sur le développement ; aucun cas nouveau ne l’a déclenchée dans les cibles externes réservées.

Ce cycle prolonge le [premier rapport](./strong-concordance-night-results-2026-10-01.md). Le point de comparaison est le module de `068ec2107`, y compris sa projection explicite visible/vide/incertain, rejoué sur les mêmes nouveaux textes que les candidats. Le lecteur canonique initial est celui de `dec602f8d`, inchangé entre les variantes. Les scores ci-dessous ne se comparent pas directement aux chiffres du précédent rapport : les chapitres réservés sont nouveaux.

## Protocole et séparation des données

Les 17 chapitres de développement réunissent le développement et la réserve finale déjà consultés du premier cycle : **459 versets par édition**. Les huit nouveaux chapitres réservés sont **Exode 17, 1 Samuel 7, Psaume 29, Proverbes 9, Ésaïe 3, Luc 6, Romains 13 et Apocalypse 22**, soit **172 versets par édition**, 88 AT et 84 NT. La sélection par empreinte de chapitre exclut toutes les réserves et tous les chapitres précédemment consultés.

L’acquisition publique S21/NEG utilise le parseur vérifié du premier cycle. Le corpus retenu comprend 50 pages et 1 262 textes d’édition. Notes, titres et interface sont exclus ; les continuations poétiques, répétitions, identifiants source et groupes discontinus sont conservés. URL, dates et empreintes restent locales. Les deux réserves retirées/consommées du précédent cycle ne sont jamais présentées comme des tests indépendants ici.

Les annotations cibles sont réservées à l’évaluateur. Les prédictions reçoivent le texte masqué, STEP et les témoins autorisés. S21/NEG n’alimentent aucun lexique prédictif ; le dictionnaire français historique et les corrections/caches de modèles restent exclus. Chaque ligne STEP utilisée est rattachée à son fichier, sa ligne et l’empreinte du dossier initial. Le calcul prédictif interdit `fetch` et n’appelle aucun modèle.

Les scénarios restent distincts : avec LSG disponible, puis sans la famille Segond. Darby et DarbyR constituent une seule famille. Les contrôles de ces deux éditions excluent leur famille entière. Leur score mesure l’accord éditorial, pas une vérité sémantique indépendante ; les réserves portent sur le réglage des règles et ne suppriment pas la présence d’autres témoins dans les chapitres évalués.

## Ce qui change

**Lecture lexicale.** Le modèle confondait toute différence avec L/NKO avec une lecture incertaine. La nouvelle classification accepte les indicateurs mineurs TAHOT attachés à L lorsqu’aucune variante de sens ne les contredit. Pour TAGNT, il faut une ligne primaire N, les trois groupes d’éditions représentés, des indicateurs uniquement mineurs et la même identité STEP exacte et catégorie grammaticale dans toutes les alternatives décrites. Les marqueurs originaux et variantes restent stockés. La grammaire et le choix d’édition sont explicitement non adjugés : une même identité lexicale ne résout pas à elle seule toutes les différences de temps, de voix ou de construction.

Les lignes alternatives seules, variantes majeures, changements de lexème ou descriptions non comprises restent incertains. Cette classification est intégrée au modèle source et au vrai résolveur canonique (`autonomous-fr-occurrences-v2`) ; elle entre dans l’empreinte du pipeline. La récupération ne peut rendre visible qu’un porteur déjà proposé, avec sa provenance. Si aucun porteur n’est établi, elle ne crée pas de vide. La règle grammaticale H0853 existante est recalculée lorsque son contexte devient utilisable, avec absence et ancrage séparés.

**Expressions.** Les locutions grammaticales dont le support serait réduit à un mot lexical sont préservées. Un connecteur français déjà autonome n’est pas étendu à son contexte. Le morphème lexical hébreu est distingué de ses préfixes : une préposition liée à un nom ne transforme pas le nom entier en préposition. Aucune expression, référence biblique ou paire Strong-synonyme particulière n’est codée en exception.

**Occurrences répétées.** Une réattribution d’article exige un lien conjoin STEP explicite, un nom/adjectif/participe source identifiable et déjà placé, une proximité française sans frontière de ponctuation, et la même forme d’article français. Les permutations sont simultanées et ne volent pas un porteur occupé. La règle reste conditionnée par la justesse du nom servant de repère ; les possessifs, relatifs et changements de construction restent hors de son périmètre.

Le développement a écarté un premier prototype trop large : il confondait certains préfixes hébreux avec la catégorie lexicale et déplaçait des déterminants entre des constructions françaises différentes. Ces essais sont archivés dans `development-exploratory-v1/`. Aucun de leurs réglages n’a utilisé les nouveaux chapitres réservés.

## Moteur commun et adaptation d’affichage

Les règles linguistiques sont communes. La variante `display-adapted`, choisie **avant** le test, préserve les expressions grammaticales pour les références publiques S21/NEG et garde la convention historique de tête d’affichage pour les contrôles CSV. Les relations proposées restent tracées séparément de l’affichage. Le développement observait autrement deux pertes de porteur exact LSG et cinq DarbyR, liées à la convention de limites.

Cette adaptation est justifiée ici par le **format et la convention d’annotation du corpus**, pas par une supposée différence de sens propre à chaque Bible. Elle ne démontre pas que Darby ou LSG devraient toujours afficher des têtes isolées dans un autre format. Une seconde adaptation, exigeant deux familles pour les limites S21, est également comparée et n’apporte pas de gain.

## Réserve : résultats avant/après

Les cellules donnent **précision / rappel / F1 exact**, en pourcentage. `legacy` est la politique du cycle précédent, `all` le candidat commun, et `display-adapted` la politique sélectionnée.

| Édition et scénario    |  Politique précédente |         Moteur commun | Affichage adapté retenu |
| ---------------------- | --------------------: | --------------------: | ----------------------: |
| S21 · cible exclue     | 94,05 / 75,83 / 83,97 | 94,25 / 76,62 / 84,53 |   94,25 / 76,62 / 84,53 |
| S21 · famille exclue   | 93,05 / 67,82 / 78,45 | 93,32 / 68,61 / 79,08 |   93,32 / 68,61 / 79,08 |
| NEG79 · cible exclue   | 95,00 / 85,06 / 89,76 | 94,97 / 85,97 / 90,25 |   94,97 / 85,97 / 90,25 |
| NEG79 · famille exclue | 93,42 / 73,14 / 82,04 | 93,48 / 73,85 / 82,51 |   93,48 / 73,85 / 82,51 |

Pour S21 avec LSG, le candidat gagne 20 porteurs exacts sans en perdre, et réduit les faux positifs exacts de 122 à 119. Sans LSG, il gagne également 20 porteurs, avec 129 → 125 faux positifs. NEG79 gagne 23 porteurs avec LSG et 18 sans LSG. Sa précision avec LSG baisse légèrement, de 95,00 % à 94,97 %, car deux nouvelles propositions ne sont pas exactes.

### Apport séparé des règles

| Réserve : F1 exact     | Précédent | Lectures seules | Expressions seules | Liens seuls | Combinaison retenue | Deux familles pour S21 |
| ---------------------- | --------: | --------------: | -----------------: | ----------: | ------------------: | ---------------------: |
| S21 · cible exclue     |     83,97 |           84,35 |              84,14 |       83,97 |               84,53 |                  84,48 |
| S21 · famille exclue   |     78,45 |           78,85 |              78,68 |       78,45 |               79,08 |                  78,17 |
| NEG79 · cible exclue   |     89,76 |           90,25 |              89,76 |       89,76 |               90,25 |                  90,25 |
| NEG79 · famille exclue |     82,04 |           82,47 |              82,09 |       82,04 |               82,51 |                  82,51 |

La correction des lectures fournit l’essentiel du rappel récupéré. Les expressions ajoutent quatre accords exacts S21 dans le scénario proche et cinq dans le scénario sans famille Segond. Les liens d’articles ne déplacent aucune occurrence dans les quatre scénarios externes réservés : **leur généralisation n’est pas démontrée par cette réserve**.

### Contrôles de régression

| Contrôle · famille exclue | F1 précédent | F1 commun | F1 avec convention adaptée | Porteurs exacts gagnés / perdus |
| ------------------------- | -----------: | --------: | -------------------------: | ------------------------------: |
| LSG                       |        83,56 |     83,98 |                      84,03 |                          18 / 0 |
| Darby                     |        84,34 |     84,56 |                      84,73 |                          18 / 0 |
| DarbyR                    |        84,35 |     84,59 |                      84,76 |                          18 / 0 |

Les trois contrôles gagnent chacun 18 porteurs exacts, sans perte d’un porteur auparavant exact avec la politique retenue. Cela ne signifie pas absence de faux positifs nouveaux : trois apparaissent chez Darby et deux chez DarbyR, examinés ci-dessous.

### AT, NT et types de difficulté

| Scénario               | Testament · versets | F1 avant → après | F1 chevauchant après |
| ---------------------- | ------------------- | ---------------: | -------------------: |
| S21 · cible exclue     | AT · 88             |    88,00 → 88,00 |                88,90 |
| S21 · cible exclue     | NT · 84             |    81,43 → 82,35 |                84,61 |
| S21 · famille exclue   | AT · 88             |    80,79 → 80,79 |                81,39 |
| S21 · famille exclue   | NT · 84             |    77,03 → 78,04 |                80,22 |
| NEG79 · cible exclue   | AT · 88             |    94,95 → 94,95 |                95,70 |
| NEG79 · cible exclue   | NT · 84             |    86,38 → 87,22 |                89,27 |
| NEG79 · famille exclue | AT · 88             |    84,64 → 84,64 |                85,45 |
| NEG79 · famille exclue | NT · 84             |    80,42 → 81,19 |                83,35 |

Exemple de ventilation, S21 avec témoins proches. Ces catégories se chevauchent et sont définies à partir de l’état source initial ; les corrections ne déplacent pas les cas dans une strate plus facile.

| Difficulté             | Versets | F1 avant | F1 après |
| ---------------------- | ------: | -------: | -------: |
| repetitions            |     123 |    83,48 |    84,14 |
| vides                  |      78 |    79,78 |    80,72 |
| expressions            |      42 |    78,54 |    79,80 |
| variantes-source       |      63 |    79,50 |    80,53 |
| relations-discontinues |       1 |    91,53 |    91,53 |

Les 112 synthèses et les 15 120 lignes de `all-metrics.tsv` donnent les mêmes ventilations pour chaque édition, scénario, genre et variante.

## Incertitude, inventaire, identité et vides

| Scénario               | Unités source | Incertains avant → après | Taux final | Versets entièrement comptabilisés avant → après |
| ---------------------- | ------------: | -----------------------: | ---------: | ----------------------------------------------: |
| S21 · cible exclue     |          2693 |                648 → 631 |    23,43 % |                                   24 → 25 / 172 |
| S21 · famille exclue   |          2693 |                843 → 827 |    30,71 % |                                   11 → 11 / 172 |
| NEG79 · cible exclue   |          2693 |                444 → 419 |    15,56 % |                                   58 → 59 / 172 |
| NEG79 · famille exclue |          2693 |                723 → 705 |    26,18 % |                                   16 → 16 / 172 |

Les identités, l’ordre des unités et leurs Strong sont conservés exactement. La couverture complète reste une mesure structurelle : elle ne certifie pas la justesse de tous les porteurs, ni tous les morphèmes de la langue source.

| Scénario               | F1 inventaire avant → après | Erreur de cardinalité avant → après | Vides établis prédits / attendus | Vides de même Strong / même ancre |
| ---------------------- | --------------------------: | ----------------------------------: | -------------------------------: | --------------------------------: |
| S21 · cible exclue     |               88,41 → 88,82 |                           533 → 516 |                          7 / 136 |                             0 / 0 |
| S21 · famille exclue   |               83,41 → 83,83 |                           730 → 714 |                          8 / 136 |                             0 / 0 |
| NEG79 · cible exclue   |               92,85 → 93,41 |                           342 → 317 |                         10 / 119 |                             0 / 0 |
| NEG79 · famille exclue |               86,36 → 86,81 |                           614 → 596 |                         10 / 119 |                             0 / 0 |

Les vides H0853 proviennent toujours de la règle grammaticale existante ; les annotations cibles ne donnent pas ici de correspondance H0853 permettant de valider leur ancrage. Aucun nouveau vide n’est ajouté sur cette réserve. Le score visible/vide et l’ancrage sont conservés séparément dans les résultats. Une recherche infructueuse ne devient jamais une absence.

L’éligibilité au score d’identité est fixe : les mêmes 75 versets externes par édition restent comparables dans chaque variante. Pour les articles répétés, un second score utilise une paire source article/nom, dont les deux ordinaux et Strong concordent avec la référence ; le nom lexical doit être unique. Le candidat ne peut pas changer son propre dénominateur en modifiant ses indicateurs de lecture.

| Identités locales article/nom | Développement : exactes avant → après / attendues | Réserve : exactes avant → après / attendues |
| ----------------------------- | ------------------------------------------------: | ------------------------------------------: |
| S21 · cible exclue            |                                   175 → 178 / 273 |                               66 → 66 / 104 |
| S21 · famille exclue          |                                   162 → 165 / 273 |                               64 → 64 / 104 |
| NEG79 · cible exclue          |                                   202 → 206 / 279 |                               74 → 74 / 102 |
| NEG79 · famille exclue        |                                   184 → 185 / 279 |                               70 → 70 / 102 |

Les permutations corrigent une à quatre identités selon les scénarios de développement sans forcément changer le multiset des porteurs. Ce bénéfice serait invisible dans un simple comptage de Strong. La réserve ne déclenche aucune réattribution ; on ne transforme pas ce résultat nul en preuve d’efficacité générale. Les CSV de contrôle ne fournissent pas d’ordinaux externes et ne servent pas à annoncer une précision d’identité locale.

## Analyse des désaccords

Les 32 dossiers stratifiés ont été examinés avec les textes, lignes STEP et témoins autorisés. Les dix désaccords exacts nouvellement introduits sur la réserve, répartis sur quatre passages et plusieurs scénarios/éditions, ont aussi été examinés. Les jugements sont assistés et exposés ; aucun n’a été réinjecté dans le moteur après gel.

- **Luc 6.9, S21/NEG** : le porteur récupéré vise bien le sabbat. Concordance annote le groupe « jour du sabbat », le moteur le nom seul. Le chevauchement est correct ; l’accord exact échoue sur les limites.
- **Luc 6.8, Darby** : le Strong de l’impératif « Lève-toi » est réactivé sur le participe de la narration suivante. C’est une erreur de placement, malgré une classification lexicale de variante défendable.
- **Apocalypse 22.5, Darby/DarbyR** : l’occurrence source de lumière est attachée à la seconde lumière française, dans une périphrase, au lieu de celle du soleil. La répétition doit être contrainte par le contexte source.
- **Apocalypse 22.12, NEG/Darby/DarbyR** : la copule source appartient à la proposition sur l’œuvre de chacun. Le moteur la réactive sur la copule de la récompense, dans une autre proposition. Darby/DarbyR offrent un verbe au bon endroit ; NEG reformule la fin sans copule explicite. C’est une erreur de placement ; pour NEG, l’absence lexicale éventuelle et l’ancrage resteraient deux décisions.

La leçon est précise : **corriger le statut d’une variante ne suffit pas à valider un porteur proposé auparavant**. Les prochaines promotions devraient contrôler leur construction locale et les autres occurrences concurrentes, notamment pour les verbes et noms répétés. Le présent cycle conserve ces erreurs mesurées, sans retoucher la réserve.

Les autres dossiers montrent des limites récurrentes : locutions verbales, noms composés sur plusieurs lignes STEP, clitiques, transformations nom/adjectif ou nom/verbe et homographes normalisés. Un exemple reste le locatif là confondu avec l’article la dans S21 Luc 22.12. Des divergences de référence existent aussi : STEP et Darby étayent Hermès pour G2060 en Romains 16.14, tandis que les annotations NEG/LSG retenues visent Hermas. Ce constat assisté n’est pas une déclaration de supériorité sur Concordance.

## Vérifications et statut de livraison

- **Reproductibilité et absence de fuite** : 114 fichiers d’entrée revérifiés ; archives `dec602f8d` et `068ec2107` contrôlées ; rejeu identique après retrait des pages, annotations et évaluations cibles. Le profil retenu a été rejoué pour S21 et DarbyR afin de couvrir les deux conventions. Il s’agit d’une séparation contrôlée des entrées et processus, pas d’une sandbox contre du code malveillant.
- **Tests** : 20 nouveaux tests TypeScript réussis ; 39 tests des outils d’expérience et 9 tests du parseur d’acquisition réussis. Suite complète : 1 147 tests, 1 124 réussis, 22 échecs préexistants identiques, 1 ignoré.
- **Compilation** : typecheck, ESLint et compilation stricte avec émission JavaScript du périmètre réussis. Le build standard garde les mêmes six erreurs TS6059 préexistantes ; il n’est pas annoncé comme réussi.
- **Intégration réelle** : un canary de trois versets déjà consultés vérifie les récupérations de H4325 en Exode 20.4 et G2090 en Luc 22.9, et le maintien de G5180/K comme incertain en Luc 22.64. Le nouveau fichier de politique est inclus dans l’empreinte du ledger ; les anciennes sorties ne peuvent pas être réutilisées silencieusement comme sorties du nouveau code.

La correction du modèle de lecture est intégrée au résolveur canonique. La combinaison complète et l’adaptation d’affichage restent un outil expérimental rejouable, sans activation dans les commandes de génération complète. Aucun modèle distant ni Laya local n’a été appelé ; aucune publication, aucun push et aucune régénération des neuf Bibles.

**Recommandation : conserver ces progrès et le protocole, puis travailler sur la fiabilité contextuelle des porteurs récupérés et les relations de groupe.** Les gains réservés sont confirmés, mais l’incertitude reste importante et quelques nouvelles propositions sont réellement mal situées. Une nouvelle réserve sera nécessaire pour corriger ces cas sans réutiliser leur réponse comme preuve de généralisation.

Le [mode d’emploi](../scripts/strong-concordance-followup/README.md) décrit le rejeu. Tous les corpus, prédictions, modifications, comparaisons, revues assistées et journaux sont sous `outputs/strong-concordance-reading-groups/`. Les fichiers principaux sont `selection.json`, `followup-freeze.json`, `all-metrics.tsv`, `regressions.json`, `assisted-review.json`, `new-disagreements-reviewed.json`, `followup-verification.json` et `selected-policy-verification.json`. Aucun texte intégral de Bible ni secret n’est ajouté aux fichiers suivis.

# Audit des calendriers de méditations

Audit du 14 septembre 2026, effectué en lecture seule sur le catalogue Firestore publié du projet `bible-strong-app`, collection `plans` et sous-collections `plan-sections`. Aucun contenu distant ni aucune donnée utilisateur n'a été modifié ou consulté.

## Résultat

**Correctif après comparaison externe :** la cohérence interne décrite ci-dessous ne garantit pas la fidélité au calendrier éditorial. Pour Les trésors de la Foi, le 29 février est déjà présent sous le titre du 1er mars ; la suite est décalée et le texte source du 31 décembre manque. Ne pas utiliser la correspondance initiale de ce recueil pour migrer sans appliquer la correction décrite en fin de rapport. Les autres recueils n'ont pas encore été comparés intégralement à leurs sources éditoriales externes.

Le catalogue contient 15 ressources : 13 recueils de méditations (8 français, 5 anglais) et les deux versions française et anglaise du plan Bible Project.

Les 4 749 entrées des recueils ont toutes une date explicite dans leur titre, en suffixe français ou anglais. Les 13 recueils ont chacun 12 sections mensuelles. Chaque date concorde avec le mois de sa section et sa position dans celle-ci. Aucun doublon de date, aucun identifiant de lecture dupliqué dans un recueil, aucune date invalide et aucune liste de blocs vide n'ont été détectés. Ce contrôle structurel ne constitue pas une relecture éditoriale des textes ou une vérification des liens multimédias.

| Recueil | Langue | Entrées | 29 février |
| --- | --- | ---: | --- |
| 365 jours pour ranimer la flamme | FR | 365 | Absent |
| Avec Dieu Chaque Jour | FR | 366 | Présent |
| La bonne semence | FR | 365 | Absent |
| Levez vos Yeux en Haut | FR | 365 | Absent |
| Les trésors de la Foi | FR | 365 | Absent |
| Puissance de la Grâce | FR | 366 | Présent |
| Tout pour qu'il règne | FR | 365 | Absent |
| Vous recevrez une Puissance | FR | 366 | Présent |
| Christ Triumphant | EN | 366 | Présent |
| Conflict and Courage | EN | 365 | Absent |
| Faith's checkbook | EN | 365 | Absent |
| God's Amazing Grace | EN | 365 | Absent |
| The Faith I Live By | EN | 365 | Absent |

Pour les neuf recueils de 365 entrées, le seul jour absent du calendrier bissextile est le 29 février. Aucun autre trou n'a été détecté.

## Conséquences pour la migration

1. Ajouter une clé éditoriale explicite `MM-DD` à chaque entrée. La correspondance est vérifiée sur toutes les dates des titres, et pas seulement déduite de la position.
2. Conserver les identifiants de recueil et de lecture actuels, sous forme de chaînes. Certains identifiants ressemblent à des décimaux (`155.24`) mais ne sont ni des nombres ni des dates.
3. Les identifiants de lecture se répètent entre recueils : l'identité doit rester composée du recueil et de l'entrée.
4. Les anciennes lectures cochées peuvent être rattachées sans ambiguïté à une entrée datée. Leur année de lecture reste inconnue : conserver un historique ancien non daté, sans marquer artificiellement l'entrée comme lue cette année.
5. Ne pas classifier selon les seules valeurs TypeScript `yearly` et `meditation`. Les valeurs réellement publiées sont `Plan annuel`, `Yearly Plan`, `Livre de méditation` et `Meditation Book`. Ajouter une classification stable indépendante de la langue, avec un adaptateur explicite pour les anciennes données.
6. Ne pas supposer que deux recueils de langues différentes ont le même calendrier : « Puissance de la Grâce » comporte 366 entrées, contre 365 pour « God's Amazing Grace ».

La [correspondance complète](data/meditation-calendar/audit.json) conserve les clés de date et les identifiants nécessaires à cette migration. Elle contient aussi les comptes mensuels, anomalies et empreintes des instantanés inspectés. Elle ne contient aucun texte intégral de méditation ni donnée utilisateur.

## Règle proposée pour le 29 février

- Si le recueil possède une entrée, afficher cette entrée le 29 février.
- Sinon, afficher une absence explicite (« Ce recueil ne propose pas de méditation pour le 29 février ») et un accès aux autres dates. Ne pas envoyer de rappel annonçant une nouvelle méditation inexistante.
- Le 1er mars reste toujours le 1er mars : aucun décalage annuel et aucune réutilisation silencieuse d'un texte sous une autre date.
- En année non bissextile, une entrée du 29 février reste consultable dans la bibliothèque du recueil, même si elle n'est pas la lecture d'un jour de cette année.

Cette règle est une proposition produit, pas un comportement déjà implémenté.

## Points éditoriaux à conserver visibles

- La description publiée des « trésors de la Foi » annonce 366 méditations, mais le contenu publié en contient 365. La comparaison externe confirme que le texte du 29 février existe sous une mauvaise date ; voir le correctif ci-dessous. La description ne doit donc pas être réduite à 365 pour masquer l'erreur d'import.
- « La bonne semence » ne porte aucune année d'édition explicite dans les métadonnées inspectées. Son calendrier est exploitable, mais il ne faut pas présenter ce contenu comme l'édition 2026 ou comme une publication renouvelée chaque année. L'année éditoriale reste à documenter à partir de la source d'import.
- Le champ `lastUpdate` ne prouve pas l'année d'édition d'un livre.
- Les correspondances sont valables pour l'instantané inspecté. Les revalider si le catalogue change avant migration.

## Reproduire

Depuis la racine du dépôt, avec Python 3 et un accès réseau :

```bash
python3 docs/research/data/meditation-calendar/fetch-source.py
python3 docs/research/data/meditation-calendar/check-calendar.py
```

Le premier script lit le catalogue distant et conserve les instantanés éditoriaux dans `.scratch/meditations-audit`. Le second produit le rapport JSON des dates et identifiants. Les requêtes distantes sont exclusivement des lectures ; aucune authentification utilisateur n'est utilisée. La classification de cet audit suit le catalogue actuel : les deux identifiants Bible Project sont exclus du contrôle des dates de méditation.

## Les trésors de la Foi : comparaison avec la source externe

Le [texte du 29 février](https://godieu.com/doc/meditations/charles-haddon-spurgeon/0229.html) est accessible en français : « Ce qui nous suit », sur Psaumes 23:6. Il parle explicitement de cette journée bissextile. Dans notre contenu, cette même méditation est déjà présente à l'identifiant `159`, section `102`, avec un suffixe indiquant le 1er mars. Il ne faut donc pas l'ajouter une deuxième fois.

La [liste éditoriale](https://godieu.com/doc/meditations/charles-haddon-spurgeon/liste.html) et la [page du 1er mars](https://godieu.com/doc/meditations/charles-haddon-spurgeon/0301.html) confirment que notre lecture suivante, identifiant `160`, correspond au 1er mars et non au 2 mars. La comparaison de tous les titres avec leurs dates sources retrouve 355 correspondances après normalisation typographique et 10 différences orthographiques mineures. La page du [22 septembre](https://godieu.com/doc/meditations/charles-haddon-spurgeon/0922.html), absente de l'index consulté, a été vérifiée séparément. Les corps des 365 méditations n'ont pas tous été comparés.

Le résultat indique que la séquence publiée correspond aux 365 premières entrées d'un calendrier de 366 jours :

- Jusqu'au 28 février, les dates correspondent.
- L'entrée `159` correspond au 29 février.
- Les entrées `160` à `464` correspondent au 1er mars jusqu'au 30 décembre, malgré leurs dates publiées allant du 2 mars au 31 décembre.
- La dernière méditation du [31 décembre](https://godieu.com/doc/meditations/charles-haddon-spurgeon/1231.html), « Aucun étranger dans le ciel », sur Psaumes 73:24, reste à importer.

L'hypothèse d'un import ayant appliqué un calendrier de 365 jours à une séquence de 366 textes explique ces observations ; le script d'import d'origine n'a pas été retrouvé, donc cette cause n'est pas démontrée.

La [correction candidate](data/meditation-calendar/ltdlf-source-correction.json) conserve les identifiants existants et propose leurs vraies dates. Lors de la correction, déplacer l'entrée du 29 février dans la section de février, corriger les suffixes de dates et répartir les autres entrées dans leurs mois réels, puis ajouter le texte du 31 décembre avec un nouvel identifiant. Ne pas renuméroter les lectures : cela déplacerait les progrès des utilisateurs vers d'autres textes. Vérifier également les anciens liens contenant un identifiant de section.

Aucune correction ni publication n'a été effectuée. Les liens vers les textes complets sont conservés ; les textes externes ne sont pas reproduits intégralement dans ce rapport.


## Opening-passage audit during integration

The 4,749 opening blocks were checked against the local reference parser. All entries have exactly one devotional block, placed first. The known standalone publisher locator prefixes are AD, CTr, CC, AG, LVH, PG, FLB and VRP; no additional locator prefix was found by the audit pattern.

There are 4,070 raw single trailing-reference shapes, 670 other shapes (including multiple references or extra text), and 9 unrecognized reference forms. This count concerns parser output, not a semantic guarantee about every verse. The application separates only an unambiguous supported trailing reference; otherwise it preserves the complete opening text. Original wording and source text are retained in both cases.

The [opening audit](data/meditation-calendar/opening-audit.json) stores counts and exceptional entry IDs without reproducing the texts. Reproduce it with `node docs/research/data/meditation-calendar/check-openings.mjs <downloaded-source-directory>`. App tests additionally exercise the actual passage resolver with French and English references, ranges, publisher locators and ambiguous forms.

## Calendriers externes vérifiés et compléments intégrés — 14 septembre 2026

Cette section complète et remplace les réserves initiales pour les recueils ci-dessous. Les nombres du premier tableau décrivent les données importées originales, avant correction.

- Huit recueils EGW : comparaison intégrale des identifiants, titres normalisés et dates avec les tables des matières de l'éditeur. Aucun identifiant absent ou supplémentaire ; résultats et empreintes conservés dans `data/meditation-calendar/egw-results.json`. Cette vérification porte sur le calendrier et non sur une nouvelle édition des textes.
- Spurgeon anglais : 365 titres correspondent aux dates non bissextiles de la [source historique](https://archive.spurgeon.org/fcb/fcb-bod.htm). Le 29 février manque dans l'import et a été ajouté ; aucun décalage des jours suivants ne s'applique à ce recueil. Spurgeon français : le texte historique du [31 décembre](https://godieu.com/doc/meditations/charles-haddon-spurgeon/1231.html), corroboré par [Biblia Universalis](https://www.bibliauniversalis3.com/textes/l.php?f=366.html&l=CHS_TDF), complète la correction des 365 identifiants existants.
- Houstin : l'utilisateur a retenu le [PDF officiel 2020](https://heritier.xyz/assets/files/365-jours-PDF.pdf) comme calendrier canonique. Il contient 366 dates. L'EPUB contient une lecture supplémentaire au 12 juillet, « L’unité du Corps de Christ », conservée comme lecture complémentaire sous l'identifiant historique 293. Les dates corrigées sont liées aux titres originaux vérifiés, sans renumérotation.
- Les 17 juillet et 31 décembre absents de l'import Houstin sont ajoutés sous `365j-07-17` et `365j-12-31`. Le PDF répète effectivement « Repentance » les 17 et 18 juillet : nous conservons cette particularité éditoriale. Chaque paragraphe des deux transcriptions EPUB a été comparé au PDF après normalisation typographique pour la comparaison seulement ; les transcriptions intégrées gardent leur texte. Voir `houstin-supplement-verification.json`. L'ouvrage indique CC BY-ND 2.0 ; les compléments conservent leur auteur et la source, sans réécriture du contenu.

Les corrections sont des projections à la lecture et ne modifient ni les données publiées ni les identifiants de progression. Les compléments ne s'appliquent qu'au corpus complet et à la révision auditée, avec contrôle des titres d'ancrage. Une entrée publiée explicitement pour la même date prend priorité. La vérification externe de Chambers et de La Bonne Semence reste incomplète.

## Identité des plans Bible Project embarqués et distants

La comparaison du 14 septembre 2026 vérifie 358 lectures dans chacune des versions française et anglaise, avec les mêmes identifiants dans le même ordre. Les blocs de lectures bibliques et leurs identifiants correspondent. Dix entrées françaises divergent uniquement sur neuf liens vidéo et une description ; six entrées anglaises divergent uniquement sur des liens vidéo. Ces différences ne nécessitent aucune renumérotation du suivi. Les versions embarquées n'ont pas de lastUpdate ; une acquisition distante conserve l'identité du plan et peut actualiser ses métadonnées sans créer une seconde participation.

La durée affichée doit provenir des 358 lectures effectivement disponibles, sans annoncer arbitrairement 365 jours. Cette comparaison ne constitue pas une vérification de disponibilité des liens vidéo.

Preuve : [comparaison des identités et champs](data/meditation-calendar/bible-project-identity-comparison.json). Reproduction : `python3 docs/research/data/meditation-calendar/compare-bible-project.py <dossier-des-instantanés>`.

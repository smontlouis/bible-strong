# Bible Annotée de Neuchâtel — audit des droits et des sources numériques

Audit réalisé le 28 août 2026. Il s'agit d'une analyse documentaire destinée à orienter l'intégration dans Bible Strong, pas d'un avis juridique.

## Décision courte

**Décision mise à jour le 28 août 2026 : le responsable de Bible Strong confirme disposer de l’autorisation ThéoTeX couvrant l’intégralité de la ressource. L’import de la transcription ThéoTeX peut donc avancer dans le prototype JSON. La pièce établissant cet accord doit encore être rattachée au registre de provenance.**

L’œuvre imprimée historique est par ailleurs dans le domaine public. L’absence de licence ouverte affichée publiquement sur le site avait conduit l’audit initial à recommander une attente ; cette réserve est levée pour Bible Strong par l’autorisation directe confirmée par le responsable du projet.

Décision opérationnelle actuelle :

1. importer les commentaires et introductions ThéoTeX dans le prototype exclusivement JSON ;
2. conserver URL et hash de chaque page, ainsi qu’un manifeste compact versionné ;
3. enregistrer la ressource comme `available` avec `CustomPermission` ;
4. différer toute conception SQL ou SQLite à une phase ultérieure distincte.

Résultat de l’import : 23 320 unités françaises sur 66 livres, extraites de 1 642 pages sources. Le manifeste se trouve dans `apps/resource-studio/workflows/commentaries/data/audit/bible-annotee.json`. Une page NT tronquée à la source ne contient aucune note exploitable et demeure signalée comme lacune.

## Ce que recouvre exactement « Bible Annotée »

Le nom masque plusieurs couches qu'il faut traiter séparément :

| Couche | Contenu | Situation |
|---|---|---|
| Œuvre imprimée — Ancien Testament | Traduction, introductions, analyses et notes d'une société de théologiens et pasteurs sous la direction de Frédéric Godet ; contributions notamment de Félix Bovet, Augustin Grétillat, Charles Monvert et Paul de Coulon | Domaine public |
| Œuvre imprimée — Nouveau Testament | *Le Nouveau Testament expliqué* de Louis Bonnet, revu et augmenté par Alfred Schroeder | Domaine public |
| Citations bibliques | Traduction propre à l'ensemble : AT principalement Félix Bovet ; NT Louis Bonnet, issu d'une révision devenue très substantielle d'Ostervald | Domaine public comme les commentaires historiques, sous réserve de ne pas substituer une réédition moderne remaniée |
| Transcription 2004-2005 | Numérisation signalée au nom de Claude Royère ; notes du NT signalées au nom d'Yves Petrakian | Pas de licence ouverte trouvée |
| Organisation numérique | Découpage par livre, chapitre et verset, corrections, liens, HTML et éventuelle base de données des sites actuels | Peut porter des droits ou des obligations contractuelles distinctes ; ne pas recopier sans permission |

La [page de présentation de Lueur](https://www.lueur.org/bible/version/annotee-neuchatel.html) attribue explicitement la numérisation à Claude Royère en 2004-2005 et celle des notes du Nouveau Testament à Yves Petrakian. Elle présente les 66 livres protestants, les introductions, les études et les commentaires. Cette page est la meilleure source primaire trouvée pour la provenance de la transcription actuellement diffusée.

## Éditions imprimées et auteurs

### Ancien Testament

Google Books conserve une numérisation institutionnelle de *La Bible annotée : Ancien Testament*, publiée par Attinger Frères en 1881. La notice crédite Frédéric Godet, Augustin Grétillat, Charles Monvert, Paul de Coulon et Félix Bovet ; l'exemplaire vient de la Bibliothèque universitaire de Bâle et a été numérisé en 2024. La page propose une autre édition en « Full view » et les commandes PDF/EPUB : [notice Google Books](https://books.google.com/books/about/La_Bible_annot%C3%A9e.html?id=z_7k0AEACAAJ).

Une seconde [notice Google Books, exemplaire de Harvard](https://books.google.com/books/about/La_Bible_annot%C3%A9e_par_une_soci%C3%A9te_de_th.html?id=fEnEXzG8LXUC), décrit les volumes 2-3 de 1881 et renvoie à une édition de 1889 en lecture intégrale. Ces notices établissent l'existence de scans institutionnels exploitables pour un travail d'inventaire/OCR ; elles ne démontrent pas encore qu'un seul jeu téléchargeable contient tous les fascicules jusqu'à l'achèvement de l'Ancien Testament.

La [notice d'autorité BnF de Félix Bovet](https://catalogue.bnf.fr/ark:/12148/cb124597546) donne ses dates 1824-1903. Les notices Google Books situent la publication au XIXe siècle et identifient les principaux contributeurs. Même si certains fascicules sont présentés comme le travail d'une société et ne nomment pas chaque apport individuel, la publication échelonnée est achevée depuis bien plus de 70 ans.

### Nouveau Testament

La [notice institutionnelle RERO](https://bib.rero.ch/global/documents/1237784) décrit quatre volumes du *Nouveau Testament expliqué*, « édition revue et augmentée par Alfred Schroeder », et précise qu'il s'agit d'une reproduction de la deuxième édition publiée chez Georges Bridel à Lausanne en 1895. RERO identifie Alfred Schroeder comme éditeur, 1860-1926.

Lueur reproduit en outre les préfaces historiques dans lesquelles Louis Bonnet signe les états de 1875 et 1891 et décrit le travail de son petit-fils Alfred Schroeder. Louis Bonnet est mort en 1892 ; Schroeder, dernier réviseur nommé, en 1926. Son apport est donc lui aussi sorti des droits patrimoniaux depuis longtemps.

Attention aux réimpressions modernes (PERLE/Emmaüs, Impact, SpiBook, ThéoTeX) : elles peuvent incorporer une mise en page, des corrections, une couverture, un nouvel appareil ou d'autres choix éditoriaux protégés. Le domaine public de l'édition historique ne confère pas un droit de copier une réédition récente.

## Analyse juridique par couche

### 1. Texte et commentaires historiques

En France, [l'article L123-1 du Code de la propriété intellectuelle](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278937) fixe la durée ordinaire aux 70 années suivant l'année civile du décès de l'auteur. Pour les œuvres anonymes ou collectives, [l'article L123-3](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278941) fixe 70 ans à partir de l'année suivant la publication et prévoit le calcul séparé pour une publication échelonnée.

En Suisse, pays de publication et de plusieurs auteurs, [les articles 29 à 32 de la loi fédérale sur le droit d'auteur](https://www.fedlex.admin.ch/eli/cc/1993/1798_1798_1798/fr) retiennent également 70 ans après le décès, 70 ans après la mort du dernier coauteur lorsque les contributions sont indissociables, et 70 ans après publication lorsque l'auteur est inconnu. L'[Institut fédéral de la propriété intellectuelle](https://www.ige.ch/fr/proteger-votre-pi/droit-dauteur/notions-fondamentales) confirme qu'une œuvre entre alors dans le domaine public et peut être réutilisée.

Conclusion : les éditions historiques de l'AT (XIXe siècle, achevées à la fin du siècle) et du NT Bonnet-Schroeder (dernier réviseur nommé mort en 1926) sont dans le domaine public en France comme en Suisse. Cela couvre leurs traductions bibliques, introductions et commentaires tels qu'ils figurent dans ces éditions historiques.

### 2. Transcription, correction et édition numériques

Le fait que le texte source soit dans le domaine public ne place pas automatiquement chaque édition numérique moderne sous licence ouverte. Une transcription strictement mécanique peut ne pas atteindre le seuil d'originalité, mais des corrections, une modernisation, une sélection, un balisage éditorial ou une nouvelle présentation peuvent constituer des apports protégés. L'[Institut fédéral suisse](https://www.ige.ch/fileadmin/user_upload/schuetzen/urheberrecht/f/Fiche_d_information_sur_le_domaine_public_FR_2020.pdf) indique expressément qu'une nouvelle édition corrigée ou modernisée doit être évaluée selon l'importance et le caractère individuel de ses adaptations ; l'œuvre historique, elle, demeure libre.

Une extraction en masse peut également rencontrer le droit du producteur de base : [l'article L341-1 du CPI](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006279245) protège une base dont la constitution, la vérification ou la présentation atteste un investissement substantiel. [L'article L342-5](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006279256) prévoit 15 ans, renouvelables lorsqu'un nouvel investissement substantiel intervient. Il n'est pas possible, à partir des pages publiques, de dater les éventuels investissements ultérieurs de Lueur ni de conclure que cette couche est expirée.

### 3. Conditions des détenteurs de la transcription

La réponse contractuelle est plus nette que l'incertitude précédente :

- [ThéoTeX](https://theotex.org/theotex_read.html) autorise la lecture gratuite en ligne, vend ses PDF/EPUB, et répond explicitement « Non » à la question de placer ces livres en téléchargement sur un autre site.
- Les [conditions générales de Lueur](https://www.lueur.org/site/cgu.html) demandent une autorisation préalable pour toute reproduction, publication ou copie, limitent l'utilisation au cadre privé et interdisent l'usage commercial. Elles ajoutent que, lorsqu'un contenu vient d'un fournisseur, celui-ci conserve ses droits de diffusion.

Ces conditions ne sont pas une licence compatible avec une redistribution JSON/SQL/SQLite. La gratuité de Bible Strong ne suffit pas à résoudre le problème : réhéberger l'ensemble dépasse l'usage privé et constitue une reproduction massive.

## Disponibilité technique constatée

| Source | Couverture constatée | Format | Licence de réutilisation structurée |
|---|---|---|---|
| [Lueur](https://www.lueur.org/bible/version/annotee-neuchatel.html) | 66 livres, texte, notes, introductions et études annoncés | Pages HTML navigables par passage | Non ; CGU restrictives |
| [ThéoTeX — interface Bible Annotée](https://theotex.org/ba/ba_h.html) | Interface statique de l'AT : 39 livres, chapitres, traduction et notes | HTML par chapitre, donc techniquement parseable | Non ; redistribution explicitement refusée sans autre autorisation |
| [Google Books — Bâle](https://books.google.com/books/about/La_Bible_annot%C3%A9e.html?id=z_7k0AEACAAJ) | Au moins un volume AT de 1881 et renvoi à une édition en lecture intégrale | Lecture, PDF et EPUB proposés par l'interface | Œuvre reconnue comme libre et téléchargement autorisé ; aucune licence trouvée pour republier le fichier de scan ou son OCR comme base complète |
| [Google Books — Harvard](https://books.google.com/books/about/La_Bible_annot%C3%A9e_par_une_soci%C3%A9te_de_th.html?id=fEnEXzG8LXUC) | Volumes AT 2-3 de 1881 ; renvoi à une édition 1889 en lecture intégrale | Lecture/scan | Même réserve |
| [RERO](https://bib.rero.ch/global/documents/1237784) | Notice bibliographique du NT en quatre volumes | Métadonnées, pas de texte intégral | Sans objet |
| CrossWire `FreBBB` | Texte biblique Bovet-Bonnet uniquement, sans commentaires | Module SWORD | Configuration officielle : `Copyrighted; Free non-commercial distribution`; ce module n'est ni une licence pour les commentaires ni une source ouverte suffisante pour notre corpus |

Google indique dans sa [présentation officielle de Google Books](https://books.google.com/googlebooks/about/) qu'un livre du domaine public peut être téléchargé en PDF. Son [aide](https://support.google.com/websearch/answer/43729) décrit aussi les téléchargements PDF/EPUB. Pour réduire les risques et améliorer la provenance, Bible Strong devrait utiliser ces fichiers uniquement comme fac-similés de contrôle/OCR, ne pas redistribuer les scans Google et publier son propre texte corrigé avec références de pages et empreintes des fichiers d'entrée.

Aucun dépôt officiel JSON, XML, OSIS, USFM ou SQLite couvrant les commentaires complets avec une licence ouverte n'a été trouvé. Le module SWORD identifié ne contient que la traduction biblique.

## Recommandation exploitable

### Option A — permission de la transcription existante (préférée)

Écrire conjointement à :

- Claude Royère / ThéoTeX (`theotex@gmail.com`, publié par le site) ;
- l'association Lueur via son [formulaire de contact](https://www.lueur.org/site/contact.html), en demandant que la réponse couvre aussi la contribution d'Yves Petrakian ou indique qui peut l'autoriser.

L'accord doit autoriser explicitement :

1. l'extraction de la totalité du texte biblique, des notes, introductions et études ;
2. la correction, la normalisation des références et le découpage par unités bibliques ;
3. la conversion et la redistribution en JSON, SQL et SQLite, y compris hors ligne dans les applications Bible Strong ;
4. les mises à jour, corrections éditoriales et migrations de format ;
5. la diffusion gratuite mondiale, sans durée limitée ;
6. le régime d'attribution précis et, si une restriction commerciale subsiste, sa définition par rapport aux boutiques d'applications, dons et services payants.

Ne pas se contenter d'une formule « vous pouvez utiliser les fichiers » : il faut nommer la redistribution, les formats dérivés et l'usage hors ligne. Archiver l'e-mail et son annexe dans le registre de provenance.

### Option B — OCR indépendant depuis les éditions libres

Si l'autorisation n'arrive pas :

1. dresser la liste bibliographique exhaustive des fascicules AT et des quatre volumes NT de l'édition historique choisie ;
2. récupérer uniquement des fac-similés institutionnels explicitement disponibles au téléchargement, ou faire scanner nos propres exemplaires ;
3. OCRiser dans un pipeline reproductible, avec image/page source, hash, version du moteur et score de confiance ;
4. conserver séparément `bibleText`, `commentary`, `introduction`, `sectionAnalysis`, `footnote` et plages de versets ;
5. effectuer une double vérification sur les noms propres, grec/hébreu, nombres et renvois ;
6. comparer un échantillon au rendu de Lueur seulement comme contrôle visuel humain, sans copier son texte ni ses corrections ;
7. publier notre transcription sous une licence explicite compatible avec la redistribution prévue.

Cette voie est légalement plus robuste mais lourde : l'ensemble représente plusieurs volumes et les notes contiennent beaucoup de références, variantes et caractères savants. Un pilote sur un petit livre (Ruth ou Jonas), puis sur un chapitre riche en notes, permettra de mesurer le coût réel avant de lancer tout le corpus.

## Conclusion historique de l’audit initial

Avant confirmation de l’accord ThéoTeX, la Bible Annotée de Neuchâtel n’était pas bloquée par les droits de ses auteurs historiques, mais par **la provenance et les conditions de la transcription moderne disponible**. La recommandation documentaire était donc de demander la permission ou de préparer un OCR indépendant.

Cette condition est désormais réputée satisfaite pour l’intégration Bible Strong sur confirmation du responsable du projet. L’analyse précédente reste conservée ci-dessus pour expliquer pourquoi l’autorisation directe et son archivage sont importants.

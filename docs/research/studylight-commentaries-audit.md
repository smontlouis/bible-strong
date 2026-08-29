# Audit de StudyLight.org comme source de commentaires

Date de l'audit : 28 août 2026

Périmètre : prototype JSON des commentaires Bible Strong ; aucun import ni aucune modification de données n'a été effectué.

## Conclusion opérationnelle

StudyLight est un **très bon catalogue de découverte et de comparaison**, mais ce n'est pas, en l'état, une source d'acquisition en masse suffisamment sûre pour Bible Strong.

- L'interface publique en direct affiche **154 commentaires anglais** et 72 entrées dans six autres langues, soit 226 fiches linguistiques. Les résultats de recherche et certains éléments de navigation affichent encore **144** en anglais : le catalogue n'est donc pas un référentiel versionné ou parfaitement cohérent ([catalogue anglais](https://www.studylight.org/commentaries/eng.html)).
- Les commentaires sont exposés sous forme de pages HTML par langue, corpus, livre et chapitre ; une version imprimable HTML existe, mais aucun téléchargement global ni aucune API JSON publique de commentaires n'a été identifié. La propre [bibliothèque hors ligne](https://www.studylight.org/offline-library.html) de StudyLight ne propose que les traductions bibliques et plans de lecture, pas les commentaires.
- Les requêtes programmatiques ordinaires vers les pages de commentaires ont reçu une page Cloudflare `403 Access Denied`, tandis que la consultation humaine fonctionne. Le `robots.txt` autorise les chemins de commentaires au groupe générique, mais interdit explicitement plusieurs robots IA et ne constitue de toute façon **ni une licence ni une autorisation de republication** ([robots.txt](https://www.studylight.org/robots.txt)).
- Les [conditions d'utilisation](https://www.studylight.org/site-resources/terms-of-use.html) permettent la copie en conservant les mentions, mais interdisent la reproduction, redistribution ou publication commerciale sans permission écrite ; la page [Rights and Permissions](https://www.studylight.org/site-resources/rights-and-permissions.html) précise que les éléments crédités à une autre source appartiennent à cette source et qu'il faut contacter celle-ci.
- La mention « These files are public domain » affichée par StudyLight n'est **pas une preuve juridique fiable**. Elle apparaît par exemple sur le commentaire de William Barclay daté 1956-1959 ([exemple StudyLight](https://www.studylight.org/commentaries/eng/dsb/2-peter-1.html)), alors qu'une œuvre littéraire reste normalement protégée dans l'UE pendant la vie de l'auteur et 70 ans après son décès ([directive 2006/116/CE](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32006L0116), [CPI L123-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278937/2019-06-01)).
- Une grande partie des œuvres historiques de StudyLight existe déjà dans STEP/CrossWire ou dans le prototype. Pour les œuvres réellement nouvelles, il faut remonter au **scan, dépôt ou éditeur d'origine**, et non recopier le HTML, la segmentation ou la base StudyLight.

Recommandation : utiliser StudyLight pour dresser la liste des candidats et contrôler la couverture, puis acquérir chaque corpus depuis sa source primaire. N'envisager un export StudyLight que si StudyLight accorde par écrit le droit de réutiliser sa transcription, son balisage, sa segmentation et sa base, et si les droits de l'œuvre ou de sa traduction sont établis séparément.

## Méthode et limites

L'audit repose sur :

1. les catalogues publics des sept langues ;
2. des pages de corpus et de chapitres représentatives ;
3. les pages officielles de conditions, permissions, robots et bibliothèque hors ligne ;
4. des sources originales lorsque l'identité ou les droits d'une ressource étaient ambigus ;
5. une comparaison de titres avec les 31 ressources du prototype local.

Le nombre de 154 en anglais vient de l'interface réellement servie le 28 août 2026 : 59 « Whole Bible », 1 AT, 20 NT, 7 Évangiles et 67 livres individuels. Les index de moteur de recherche consultés peu auparavant disaient encore 144. Cette différence de dix est conservée dans le rapport au lieu d'être artificiellement résolue.

« Disponible gratuitement en ligne » ne signifie jamais automatiquement « réutilisable, traduisible et redistribuable ». Les conclusions juridiques ci-dessous sont une analyse de risque, pas un avis d'avocat.

## Inventaire par langue

| Langue | Fiches visibles | Observation |
|---|---:|---|
| Anglais | 154 | 59 Bible entière, 1 AT, 20 NT, 7 Évangiles, 67 livres individuels |
| Français | 7 | Tous présentés comme Bible entière sauf `ntp` (NT) |
| Néerlandais | 3 | Kingcomments, Matthew Henry, Dächsel |
| Allemand | 1 | Kingcomments |
| Portugais | 3 | un corpus complet, Matthew Henry NT, Enduring Word NT |
| Russe | 7 | Calvin, Geneva, Lopukhin, Henry, Barclay, MacArthur, Treasury of David |
| Espagnol | 51 | beaucoup de traductions apparentes, mais plusieurs fiches servent encore du contenu/titre anglais |

Le total de 226 est un total de **fiches linguistiques**, pas de 226 œuvres distinctes : un même code (`mhm`, `cal`, `kng`, etc.) réapparaît dans plusieurs langues.

## Audit approfondi des sept ressources françaises

| Code | Ce que StudyLight annonce | Identification réelle / provenance | État des droits et décision |
|---|---|---|---|
| `ann` | « Bible annotée » | Le texte de Genèse 1 recouvre presque entièrement `neu`, mais les aperçus de livres sont en anglais et attribués à **Arend Remmers** ([exemple Jean](https://studylight.org/commentaries/fre/ann/john.html)). Il s'agit vraisemblablement d'une ancienne présentation incomplète ou mélangée du corpus Neuchâtel, enrichie d'aperçus étrangers. | **Ne pas importer** : doublon dégradé et provenance éditoriale incohérente. |
| `neu` | Bible Annotée de Neuchâtel | Véritable commentaire français ancien, avec introductions, plans et notes verset par verset ([Genèse 1](https://www.studylight.org/commentaries/fre/neu/genesis-1.html), [Exode 13](https://www.studylight.org/commentaries/fre/neu/exodus-13.html)). | Déjà présent dans le prototype depuis ThéoTeX avec autorisation. StudyLight n'apporte pas un nouveau corpus ; utile seulement comme témoin de comparaison. |
| `cba` | Commentaire biblique avancé | Le texte est celui des **Études sur la Parole** de J. N. Darby. La source primaire Bibliquest identifie explicitement l'auteur et fournit le découpage ([Genèse](https://www.bibliquest.net/JND/JND-ETUDES-at01-GENESE.htm)). | Œuvre originale ancienne probablement domaine public ; la transcription/structuration numérique doit venir d'une source autorisée. Candidat intéressant mais différent des simples notes de traduction Darby déjà présentes. |
| `cbi` | Commentaire biblique intermédiaire | Genèse commence par les **Notes sur le Pentateuque** de C. H. Mackintosh ; d'autres livres semblent provenir d'autres auteurs frères (ex. passages attribuables à Henri Rossier). StudyLight ne fournit pas de liste d'auteurs fiable. | **Suspendre** tant qu'un manifeste livre → auteur → édition → source n'est pas reconstitué auprès de la source originale. Ce n'est pas un corpus à auteur unique. |
| `cbs` | Commentaire biblique simple | Il s'agit de **Chaque jour les Écritures**, de Jean Kœchlin. L'éditeur Bibles et Publications Chrétiennes l'identifie explicitement et maintient encore l'édition en ligne en 2026 ([page officielle BPC](https://editeurbpc.com/etudes/chaque-jour-les-ecritures)). | StudyLight l'étiquette pourtant « domaine public » ([exemple](https://studylight.org/commentaries/fre/cbs/1-timothy-1.html)). Cette mention est insuffisante et très probablement erronée pour l'édition moderne : **demander l'autorisation à BPC/aux ayants droit**. |
| `mhn` | Commentaire concis de Matthew Henry | Traduction française du commentaire concis de Matthew Henry. L'original anglais est ancien ; l'identité, la date et le titulaire de la **traduction française** ne sont pas indiqués. | Le prototype contient déjà MHY-FR et MHCC anglais. Ne pas considérer cette traduction comme libre tant que sa provenance n'est pas établie ; comparer d'abord les textes pour éviter un doublon. |
| `ntp` | Nouveau Testament Populaire 1891 | Traduction française du **People's New Testament** de Barton W. Johnson ; le texte contient encore des renvois internes « thème Johnson ». L'original anglais correspond au PNT déjà présent. StudyLight ne documente ni le traducteur ni la date de la traduction française ([catalogue NTP](https://www.studylight.org/commentaries/fre/ntp.html)). | L'original de 1891 est ancien, mais une traduction moderne peut avoir ses propres droits. Candidat français utile seulement après identification de la traduction et comparaison avec notre PNT. |

### `ann` contre `neu`

Sur Genèse 1, les deux pages ont 1 708 mots significatifs en commun sur 1 710 mots distincts dans `ann` (similarité de Jaccard des vocabulaires : 0,939). `neu` ajoute une introduction et un plan plus riches ; `ann` segmente autrement et ses pages d'aperçu de livre injectent des résumés anglais d'Arend Remmers. Ce sont donc deux **présentations dérivées du même commentaire de base**, pas deux ressources à publier côte à côte. `neu` est la version à retenir, depuis notre source ThéoTeX autorisée.

## Formats et faisabilité technique

### Ce qui existe

- Catalogue : `/commentaries/{lang}.html`.
- Corpus : `/commentaries/{lang}/{code}.html`.
- Livre : `/commentaries/{lang}/{code}/{book}.html`.
- Chapitre : `/commentaries/{lang}/{code}/{book}-{chapter}.html`.
- Impression : ajout de `?print=yes`, qui produit encore du HTML.
- Le HTML des chapitres contient des blocs de commentaire, des titres de versets ou plages, des notes de bas de page, des liens de références et une notice bibliographique.
- Le `robots.txt` annonce deux index de sitemaps, `/commentaries/sitemap.xml` et `/commentary/sitemap.xml`, mais le premier a renvoyé la page de catalogue HTML lors du contrôle et ne peut pas être considéré comme une API stable.

### Ce qui n'a pas été trouvé

- aucune documentation d'API de commentaires StudyLight ;
- aucun manifeste JSON public ;
- aucun export ZIP, OSIS, USFM, SQLite ou SWORD ;
- aucun téléchargement global de commentaires dans la bibliothèque hors ligne ;
- aucune version figée ou empreinte de révision garantissant la reproductibilité.

### Difficultés d'un extracteur HTML

1. **Blocage automatisé** : les requêtes `curl` vers les catalogues ont été redirigées vers une page Cloudflare 403 indiquant que le motif ressemblait à du trafic automatisé.
2. **Instabilité éditoriale** : 144 et 154 coexistent ; les descriptions de livres contiennent des erreurs manifestes (« Marc » à la place d'Abdias, « Colossiens » à la place de Marc sur certaines pages françaises).
3. **Segmentation non canonique** : les entrées peuvent couvrir un verset, une plage, un chapitre ou une introduction. Le HTML est une présentation, pas un contrat de données.
4. **Mélange de couches** : texte du commentaire, aperçus génériques, liens StudyLight, notes, bibliographie, publicité et navigation sont réunis dans le même document.
5. **Provenance perdue** : les titres génériques français `cba/cbi/cbs` masquent les auteurs et éditions réels.

Techniquement, un convertisseur HTML → JSON/OSIS est possible, mais il serait fragile et juridiquement moins propre que l'import depuis une source originale structurée. Le coût principal ne serait pas le parsing, mais la vérification de provenance, de complétude et de droits.

## Droits, licence et base de données

### Trois couches à ne pas confondre

1. **Œuvre sous-jacente** : Barnes, Calvin, Henry, Darby ou Poole peuvent être dans le domaine public selon l'édition et le territoire.
2. **Traduction/transcription/édition numérique** : une traduction française ou espagnole récente, une correction OCR, des titres ajoutés et une segmentation peuvent être protégés indépendamment.
3. **Site et base StudyLight** : le HTML, les descriptions, le classement, le balisage, la compilation et la base ont leurs propres conditions.

Les conditions StudyLight protègent globalement le contenu du site et exigent une permission pour la republication commerciale. La page de permissions renvoie vers les titulaires tiers quand une source est créditée. En outre, le droit français permet au producteur d'une base d'interdire l'extraction ou la réutilisation d'une partie substantielle, ainsi que l'extraction répétée et systématique de parties non substantielles ([CPI L342-1 et suivants](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006161661/)). Le domaine public de Barnes ou Calvin ne donne donc pas automatiquement le droit de cloner la base et le balisage StudyLight.

### Le `robots.txt`

Le fichier, daté de juillet 2026 :

- n'interdit pas `/commentaries/` au robot générique ;
- bloque complètement `GPTBot`, `ClaudeBot`, `PerplexityBot`, `CCBot`, plusieurs robots SEO et `Applebot-Extended` ;
- permet à `ChatGPT-User` d'accéder au contenu central mais bloque les chemins dynamiques lourds.

Cela signifie seulement que certaines lectures automatisées sont acceptées à des fins d'indexation/citation. Le fichier ne confère aucun droit de copier ou republier. La protection Cloudflare montre en pratique qu'un moissonnage massif non coordonné serait contraire au comportement attendu du service.

### Exemples de mentions StudyLight peu fiables

- **William Barclay, Daily Study Bible (1956-1959)** : StudyLight affiche « public domain » sur ses pages ([2 Pierre 1](https://www.studylight.org/commentaries/eng/dsb/2-peter-1.html)). Une date de publication ancienne de 67 à 70 ans ne suffit pas en France/UE lorsque la durée se calcule après la mort de l'auteur.
- **Thomas Constable, édition 2012** : StudyLight affiche également « public domain » et « Text Courtesy of BibleSupport.com. Used by Permission » ([Jérémie 41](https://www.studylight.org/commentaries/eng/dcc/jeremiah-41.html)). « Used by permission » décrit l'autorisation reçue par StudyLight, pas une sous-licence accordée à Bible Strong.
- **Bob Utley, édition 2021** : StudyLight affiche encore « public domain » ([2 Pierre 1](https://www.studylight.org/commentaries/eng/ubc/2-peter-1.html)). Il faut retrouver la licence directe de Bible Lessons International.
- **Jean Kœchlin** : le corpus est publié et mis à jour par BPC aujourd'hui, malgré la déclaration générique de domaine public de StudyLight.

Conclusion juridique : traiter chaque mention de domaine public comme un **indice à vérifier**, jamais comme une autorisation d'import.

## Chevauchement avec le prototype actuel

Le prototype contient 31 ressources. Au niveau du titre ou de l'œuvre, StudyLight recoupe directement ou presque directement au moins les corpus suivants :

- Adam Clarke (`acc` ↔ ACBC), Barnes (`bnb`), Calvin (`cal`), JFB (`jfb`), Matthew Henry complet/concis, Wesley (`wen`) ;
- Abbott (`ain`), Burkitt (`wbc`), Catena Aurea (`gcc`), Geneva (`gsb`), Keil & Delitzsch (`kdo`), Kingcomments (`kng`), Lightfoot (`jlc`) ;
- Luther sur Galates (`mlg`), People's New Testament (`pnt`), Robertson Word Pictures (`rwp`), Scofield (`srn`), Fourfold Gospel (`tfg`), Treasury of David (`tod`) ;
- Bible Annotée de Neuchâtel (`neu`) ;
- probablement Edwards Family Bible (`fam` ↔ Family Notes) et des éléments Darby, à confirmer par comparaison de contenu.

StudyLight contient aussi TSK, que le projet a volontairement retiré des commentaires parce qu'il s'agit de références croisées.

Ne sont pas apportés par StudyLight sous la même forme : les corpus Aquifer comme paquet/source, Augustin et Chrysostome français, Rashi, SDABC/EGW et les annotations originales Douay–Rheims.

Une simple importation du catalogue ajouterait donc beaucoup de doublons. Le gain réel se situe dans une sélection de commentaires historiques complémentaires et quelques œuvres modernes sous licence explicite.

## Ressources nouvelles à forte valeur

### Vague A — historiques, à acquérir depuis une source primaire

Priorité élevée, après vérification de l'édition et de la transcription :

1. **Matthew Poole — English Annotations** (`mpc`) : grand classique réformé, Bible entière.
2. **John Trapp — Complete Commentary** (`jtc`) : très riche en citations historiques.
3. **Charles Simeon — Horae Homileticae** (`shh`) : angle homilétique distinct.
4. **Benson** (`rbc`) et **Coke** (`tcc`) : tradition méthodiste/arminienne, utiles pour équilibrer le catalogue.
5. **Ellicott** (`ebc`), **Lange** (`lcc`) et **Pulpit Commentary** (`tpc`) : commentaires collectifs substantiels.
6. **The Biblical Illustrator** (`tbi`), **Preacher's Homiletical** (`phc`) et **Expositor's Bible** (`teb`) : matériel homilétique et expositoire massif.
7. **Haydock Catholic Commentary** (`hcc`) : apport catholique historique aujourd'hui peu représenté.
8. **Alford Greek Testament** (`hac`), **Bengel's Gnomon** (`jab`), **Vincent Word Studies** (`vnt`), **Expositor's Greek Testament** (`egt`) : valeur linguistique NT.
9. **Dummelow** (`dcb`), **MacLaren** (`mac`), **Schaff** (`scn`), **Peake** (`pfc`), **Carroll** (`bhc`) : compléments généralistes solides.
10. **Darby, Études sur la Parole** (`cba`) : version française originale distincte des notes de traduction déjà intégrées.

Pour ces œuvres, préférer scans/texte de Project Gutenberg, Internet Archive, CCEL, CrossWire ou une édition patrimoniale, avec un manifeste précis de l'édition et une transcription indépendante.

### Vague B — modernes, seulement avec licence écrite directe

- Bridgeway (Donald Fleming), Bell, Coffman, College Press, Constable, Everett, Gann, Garner-Howes, Ger de Koning, McGee, Pett, Chuck Smith, Utley, Enduring Word/David Guzik, Peter Pett et les séries modernes de restauration.
- Les versions russes Barclay et MacArthur, le portugais Enduring Word et les traductions espagnoles modernes ne doivent pas être dérivés de StudyLight sans accord des titulaires et des traducteurs.
- `cbs`/Jean Kœchlin : demander à BPC une autorisation explicite couvrant JSON, hors-ligne, redistribution gratuite, mises à jour et traduction éventuelle.

### Vague C — à éviter ou dédupliquer

- `ann` : doublon incohérent de `neu` ;
- TSK : déjà exclu ;
- traductions où le titre est localisé mais le contenu reste anglais ;
- corpus StudyLight dont l'auteur, le traducteur ou la source de numérisation n'est pas identifiable ;
- corpus déjà présents sans preuve d'une édition plus complète ou meilleure.

## Chemin d'acquisition recommandé

1. Utiliser l'inventaire StudyLight comme **liste de candidats**, jamais comme source brute par défaut.
2. Pour chaque candidat, créer une fiche : œuvre, auteur(s), dates, édition, langue originale, traducteur, source du fichier, titulaire, licence, couverture biblique et granularité.
3. Chercher dans cet ordre : dépôt officiel de l'auteur/éditeur ; STEP/CrossWire ; dépôt patrimonial ou scan ; transcription ouverte documentée.
4. Comparer les empreintes et extraits avec StudyLight pour confirmer l'identité et repérer les coupures, sans copier son balisage.
5. Pour une œuvre moderne, obtenir un accord écrit couvrant explicitement : reproduction intégrale, adaptation JSON/OSIS, téléchargement hors ligne, redistribution mondiale, gratuité et éventuelles traductions.
6. Si StudyLight est la seule source numérique, demander deux autorisations séparées si nécessaire : StudyLight pour la base/transcription ; auteur, éditeur ou ayant droit pour l'œuvre/traduction.
7. Importer dans le prototype JSON avec `sourceEdition`, `sourceUrl`, `license`, `rightsHolder`, `permissionEvidence`, `translator`, `acquiredAt` et un hash de l'artefact source.
8. Ne pas lancer de crawler tant que la permission et un mode d'accès raisonnable (export, archive ou cadence convenue) ne sont pas obtenus.

## Inventaire anglais complet (snapshot live)

Les codes sont ceux des URL StudyLight. Cet inventaire décrit la présence, pas le droit de réutilisation.

### Bible entière (59)

`bnb` Barnes; `cbb` Bell; `rbc` Benson; `bbc` Bridgeway; `bul` Bullinger; `cal` Calvin; `bhc` B. H. Carroll; `acc` Clarke; `bcc` Coffman; `tcc` Coke; `col` College Press; `jfb` JFB abrégé; `jfu` JFB non abrégé; `dcc` Constable; `dsn` Darby Synopsis; `dcb` Dummelow; `ebc` Ellicott; `ghe` Everett; `edt` Expositor's Dictionary of Texts; `gab` Gaebelein; `gbc` Gann; `ghb` Garner-Howes; `gsb` Geneva; `geb` Gill; `lmg` Grant; `jgc` Gray; `pmc` Hawker; `hcc` Haydock; `mhm` Matthew Henry complet; `mhn` Matthew Henry concis; `fbh` Hole; `kng` Kingcomments; `kpc` Kretzmann; `lcc` Lange; `mac` MacLaren; `ttb` McGee; `fbm` F. B. Meyer; `gcm` Morgan; `jpb` Parker; `pfc` Peake; `pet` Pett; `mpc` Poole; `phc` Preacher's Homiletical; `srn` Scofield; `sbc` Sermon Bible; `shh` Simeon; `csc` Chuck Smith; `spe` Spurgeon Verse Expositions; `jsc` Sutcliffe; `tbi` Biblical Illustrator; `cpc` Church Pulpit; `teb` Expositor's Bible; `tpc` Pulpit; `jtc` Trapp; `tsk` Treasury of Scripture Knowledge; `lwc` Wells of Living Water; `wen` Wesley; `whe` Whedon; `nec` New European Christadelphian.

### Ancien Testament (1)

`kdo` Keil & Delitzsch.

### Nouveau Testament (20)

`ctf` Contending for the Faith; `ain` Abbott; `hac` Alford; `dsb` Barclay; `jab` Bengel; `wbc` Burkitt; `cgt` Cambridge Greek Testament; `fam` Edwards Family Bible; `loi` Light of Israel; `ges` Godbey; `aek` Knoch; `hms` Mahan; `hmc` Heinrich Meyer; `egt` Expositor's Greek Testament; `boc` Orchard Catholic; `pnt` People's NT; `rwp` Robertson; `scn` Schaff; `ice` Bible Study NT; `vnt` Vincent.

### Évangiles seulement (7)

`tgc` Gospels Compared; `bnc` James Brown; `gcc` Catena Aurea; `jlc` Lightfoot; `oca` McGarvey Selected Books; `ryl` J. C. Ryle; `tfg` Fourfold Gospel.

### Livres sélectionnés (67)

`jbc` Beet; `cbn` Bowman; `box` Charles Box; `cbp` Bridges on Proverbs; `jbm` Broadus on Matthew; `jbs` John Brown; `ntc` Caton; `dsc` D. S. Clark; `sdn` Derickson; `dun` Dunagan; `jec` Eadie; `fbn` Fairbairn; `gsc` Godet; `mgg` Gutzke; `hal` Haldane; `ghc` Hampton; `shj` Harvey on John; `gtb` Hastings; `heg` Hengstenberg; `hor` Hinds; `hdg` Hodge; `icc` International Critical Commentary NT; `isn` Ironside; `jom` J. D. Jones; `hkr` Keathley; `wkc` William Kelly; `hkc` Knollys; `dkr` Koenig; `clc` Cornelius a Lapide; `clr` Larkin; `lbc` Layman's Bible Commentary; `bch` Light & Truth; `dlc` Lipscomb; `bpc` Brad Price; `mlc` Luscombe; `mlg` Luther on Galatians; `nfp` Mackintosh Pentateuch; `dcp` Meyer on Philippians; `gmt` Milligan; `jgm` Mitchell; `onr` Restoration Commentary; `mce` Mylne; `wnc` Newell; `nor` Norris; `joc` John Owen; `jcp` Philpot; `awp` A. W. Pink; `rey` Reynolds; `crc` Charles Rose; `tsp` Thomas Scott on Psalms; `sor` Walter Scott; `sei` Seiss; `hsw` Hamilton Smith; `tod` Treasury of David; `rsc` Candlish on 1 John; `ubc` Utley; `foy` Foy Wallace; `war` Wardlaw; `rwc` Richard Watson Exposition; `wat` Richard Watson Commentary; `znt` Zerr; `ibs` International Bible School; `fdc` Fortner; `bwj` B. W. Johnson Collected; `adr` Dellerba; `exp` Bible Explained Matthew/Mark; `ate` Turner.

## Inventaire non anglais complet

### Français (7)

`ann` Bible annotée; `cba` Commentaire biblique avancé; `cbi` Commentaire biblique intermédiaire; `cbs` Commentaire biblique simple; `mhn` Commentaire concis de Henry; `neu` Bible Annotée de Neuchâtel; `ntp` Nouveau Testament Populaire 1891.

### Néerlandais (3)

`kng` Kingcomments; `mhm` Matthew Henry; `dac` Dächsel.

### Allemand (1)

`kng` Kingcomments.

### Portugais (3)

`cbc` Comentário Bíblico Completo; `mhn` Matheus Henry NT; `tew` Enduring Word.

### Russe (7)

`cal` Calvin; `gsb` Geneva; `lop` Alexander Lopukhin; `mhm` Matthew Henry; `dsb` Barclay; `mac` John MacArthur; `tod` Treasury of David.

### Espagnol (51)

`acc` Clarke; `bnb` Barnes; `geb` Gill; `mhm` Matthew Henry; `cal` Calvin; `spe` Spurgeon; `tpc` Pulpit; `rbc` Benson; `tbi` Biblical Illustrator; `csc` Chuck Smith; `teb` Expositor's Bible; `ebc` Ellicott; `bul` Bullinger; `pet` Pett; `hcc` Haydock; `wen` Wesley; `jfb` JFB; `gab` Gaebelein; `jfu` JFB unabridged; `tcc` Coke; `fbm` F. B. Meyer; `srn` Scofield; `dcb` Dummelow; `jtc` Trapp; `kpc` Kretzmann; `pmc` Hawker; `sbc` Sermon Bible; `dsn` Darby Synopsis; `cpc` Church Pulpit; `lmg` Grant; `lwc` Wells of Living Water; `jsc` Sutcliffe; `gcm` Morgan; `rwp` Robertson; `egt` Expositor's Greek Testament; `cgt` Cambridge Greek Testament; `ice` Bible Study NT; `scn` Schaff; `fam` Family Bible; `gcc` Catena Aurea; `clc` Lapide; `dun` Dunagan; `gsc` Godet; `ghc` Hampton; `jbs` Brown; `box` Box; `dsc` D. S. Clark; `nfp` Mackintosh; `joc` Owen; `wkc` Kelly; `mlc` Luscombe.

Plusieurs de ces 51 fiches gardent un titre anglais dans le catalogue espagnol ; leur présence dans la langue espagnole ne prouve donc pas que le corps du commentaire est réellement traduit intégralement.

## Décision proposée

**Ne pas lancer un import StudyLight.** Ajouter StudyLight à la documentation comme source de repérage, puis ouvrir une vague d'acquisition ciblée : Poole, Trapp, Simeon, Benson, Coke, Haydock, Ellicott/Lange, puis les corpus linguistiques NT. En parallèle, contacter BPC pour Jean Kœchlin et identifier la traduction française du PNT. Si StudyLight accepte de fournir une archive et un accord de redistribution, refaire alors un audit ressource par ressource sur cette archive exacte avant toute conversion JSON.

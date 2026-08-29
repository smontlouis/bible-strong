# Audit des commentaires bibliques ouverts en français et en anglais

**Date de l'audit :** 27 août 2026

**Périmètre actuel :** issue [#326](https://github.com/smontlouis/bible-strong/issues/326), acquisition, normalisation et lecture de commentaires bibliques dans le prototype JSON ; les formats de base de données sont différés

**Statut :** audit de faisabilité et de droits, pas un avis juridique

## Conclusion exécutive

> **Mise en œuvre du 28 août 2026.** Les vagues 1 et 2 ont été intégrées intégralement au prototype JSON : MHCC, JFB, Wesley, Augustin, Chrysostome, Calvin, Treasury of David et Rachi. Avec les quatre corpus déjà présents, la bibliothèque locale atteint 145 713 unités réparties en 11 006 fragments par chapitre. Les huit nouveaux corpus restent dans leur langue source ; aucune traduction automatique n'a été lancée. Vingt marqueurs CrossWire vides `[]` sont exclus. Le manifeste versionné [`waves-1-2.json`](../../apps/resource-studio/workflows/commentaries/data/audit/waves-1-2.json) conserve les versions, licences et hashes exacts.

> **Traductions françaises du 28 août 2026.** Trois agents `gpt-5.6-luna` en effort `xhigh` ont produit 777 traductions traçables dans 50 lots JSON, sans DeepL : les 747 absences ACBC, l'unique absence Aquifer et 29 textes Barnes. Après déduplication par hash, ces 29 textes couvrent 109 passages Barnes. Le lecteur ne compte plus aucune absence ACBC ou Aquifer ; Barnes passe alors de 1 754 à 1 645 absences.

> **Achèvement Barnes du 29 août 2026.** Trois agents `gpt-5.6-luna` en effort `high` ont complété les 1 645 rattachements Barnes restants à partir de 950 textes anglais uniques, répartis dans 77 lots. La bibliothèque JSON contient désormais une traduction française pour 18 570/18 570 unités Barnes et 24 224/24 224 ancres source (`missingCount: 0`). Le contrôle a supprimé quatre blocs de navigation, formulaire et publicité StudyLight, corrigé les segments anglais résiduels et validé les hashes, passages et structures HTML. Ces traductions constituent désormais le contenu français publiable de référence.

> **Vague 3 du 28 août 2026.** Le responsable Bible Strong confirme avoir obtenu auprès de STEP et des auteurs les droits nécessaires pour les ressources repérées dans STEP. Dix-sept corpus ont été exportés pour audit, mais seuls seize commentaires sont intégrés au lecteur JSON : Abbott, Burkitt, Catena Aurea, Darby Notes, Family Notes, Geneva Notes, Keil & Delitzsch, KingComments, Lightfoot, Luther, Matthew Henry complet, Matthew Henry Modern English, People’s New Testament, Robertson’s Word Pictures, Scofield et Fourfold Gospel. Ils ajoutent 101 841 unités anglaises. TSK est exclue du lecteur car elle alimente déjà les références croisées `TRESOR` de Bible Strong ; `TNotes` n’est pas dupliqué car il s’agit des Tyndale Open Study Notes déjà importées depuis Aquifer ; `Spurious` reste exclu car il s’agit d’un appareil de variantes. Le manifeste versionné [`wave-3.json`](../../apps/resource-studio/workflows/commentaries/data/audit/wave-3.json) conserve versions, URLs, licences déclarées, autorisation et hashes.

Il existe assez de matière légalement réutilisable pour lancer un catalogue solide sans traduire immédiatement des millions de mots. Le meilleur premier lot est :

1. **Tyndale Open Study Notes / Bible Aquifer en français et en anglais**, sous CC BY-SA 4.0 : 66 livres dans les deux langues et près de 17 000 unités par langue. C'est de loin le meilleur socle bilingue moderne immédiatement structuré.
2. **Albert Barnes en anglais**, domaine public via CrossWire/SWORD : bon candidat attendu par le produit, déjà présent dans Firestore, mais limité au Nouveau Testament malgré le titre de module.
3. **Jamieson-Fausset-Brown ou Matthew Henry Concise en anglais**, domaine public via CrossWire : ils apportent une couverture de toute la Bible protestante. JFB diversifie davantage le catalogue ; MHCC facilite la comparaison avec la ressource historique de Bible Strong.
4. **Augustin et Jean Chrysostome en français**, domaine public via CrossWire : deux vraies ressources françaises redistribuables, mais patristiques et à couverture irrégulière. Elles complètent Aquifer ; elles ne le remplacent pas comme commentaire continu moderne.
5. En deuxième vague, **Rachi en anglais via Sefaria** (CC BY, Ancien Testament), **Calvin**, **Keil & Delitzsch**, **Catena Aurea** et les **annotations originales de la Douay-Rheims** apportent des traditions exégétiques différentes, sous réserve des contrôles de version et de provenance détaillés plus bas.

L'autorisation historique de Dominique Osché a été retrouvée. Dans l'échange du 1er novembre 2019 fourni pendant cet audit, Bible Strong demande la version HTML la plus récente pour l'application gratuite `bible-strong.app`; Dominique répond en transmettant « la version bu3, la plus à jour », le fichier `MHY.zip` et un relevé de décalages. L'intégration lui est ensuite confirmée le 6 novembre. Cette pièce établit la provenance et une permission directe pour l'usage historique dans l'application gratuite. Elle doit être archivée avec ses pièces jointes et enregistrée comme **permission personnalisée**, et non comme `Public domain`. Pour éviter toute ambiguïté future, il reste souhaitable de faire confirmer en une phrase que la permission couvre également le réhébergement dans la base Bible Strong, l'API, le SQLite hors ligne, les mises à jour et un éventuel usage commercial. Ce point n'empêche pas l'inventaire ni la migration technique à périmètre d'usage constant.

## Ce que signifie « ouvert » dans cet audit

Une ressource « lisible gratuitement » n'est pas nécessairement réutilisable par Bible Strong. Pour entrer dans la base canonique et dans un SQLite téléchargé, il faut que les droits autorisent au minimum : extraction, transformation, hébergement, redistribution électronique, usage hors ligne et, si l'application peut être monétisée, usage commercial.

| Classe | Ingestion et redistribution | Traduction/adaptation | Décision par défaut |
|---|---:|---:|---|
| Domaine public / CC0 | Oui | Oui | Admettre après contrôle de provenance |
| CC BY 4.0 | Oui, y compris commercialement | Oui, avec attribution et indication des changements | Admettre avec métadonnées obligatoires |
| CC BY-SA 4.0 | Oui, y compris commercialement | Oui ; l'adaptation doit rester sous la même licence | Admettre dans une ressource isolée et exportable sous BY-SA |
| Licence « permission donnée à CrossWire » | Non transférable par défaut | Non | Refuser sans permission propre à Bible Strong |
| Gratuit, non commercial, ou `NC` | Pas pour un produit dont le modèle peut évoluer | Selon licence, généralement trop restrictif | Refuser par défaut |
| `ND`, tous droits réservés, licence inconnue | Non | Non | Refuser |

La licence du moteur SWORD, du dépôt Git ou de l'API n'accorde aucun droit sur les textes tiers qu'ils transportent. Chaque œuvre, version linguistique et édition numérique doit avoir sa propre preuve de droits.

## État actuel de Bible Strong

Le projet Firebase `bible-strong-app` expose actuellement **30 826 documents `verse-commentaries`** en lecture publique. Pour Genèse 1:1, les œuvres non adventistes observées sont :

- `acbc` — *Adam Clarke Bible Commentary*, ordre 0 ;
- `barnes` — *Albert Barnes Notes on the Whole Bible*, ordre 1 ;
- `mhcc` — *Matthew Henry Concise*, ordre 3 ;
- de nombreuses autres entrées sont marquées `isSDA` et attribuées à Ellen G. White.

La présence technique d'un corpus dans Firestore ne constitue pas une preuve de licence. Chaque corpus doit repasser par le registre de provenance proposé dans cet audit avant migration.

Le dépôt contient déjà une ressource canonique française `mhy-fr` de 4 145 entrées et une publication SQLite fonctionnelle. La configuration déclare toutefois le titulaire `Public domain`, alors que la traduction est créditée à Dominique Osché et que la [notice de l'édition française](https://biblia.com/books/ec-ldpmhecomconcis) crédite Yvon L'Hermitte et Dominique Osché, Éditions CLÉ, 2010. L'œuvre anglaise originale est dans le domaine public, mais sa traduction moderne ne l'est pas automatiquement. Il faut donc :

- archiver durablement le courriel complet du 1er novembre 2019, `MHY.zip`, le fichier de décalages et leurs hashes ;
- enregistrer les droits comme `CustomPermission` avec Dominique Osché comme fournisseur et la portée prouvée par l'échange ;
- remplacer `Public domain` dans `rightsHolder`/`termsReference` par des métadonnées exactes, sans effacer les crédits d'Yvon L'Hermitte et d'Éditions CLÉ indiqués par l'édition publiée ;
- obtenir si possible une confirmation courte couvrant explicitement SQL, API, SQLite hors ligne, corrections et usage commercial éventuel.

### État mesuré des traductions françaises ACBC, Barnes et MHCC

Le 27 août 2026 à 21:27 (Europe/Paris), un parcours exhaustif des **30 826** documents de versets et de leurs sous-collections a comparé les identifiants source aux **149 402** documents présents dans `commentaries-FR`. Le parcours s'est terminé sans erreur réseau. Résultat :

| Corpus source | Commentaires anglais | Documents FR présents | Manquants | Couverture documentaire |
|---|---:|---:|---:|---:|
| Adam Clarke (`acbc`) | 20 794 | 20 047 | **747** | **96,41 %** |
| Albert Barnes (`barnes`) | 24 224 | 22 470 | **1 754** | **92,76 %** |
| Matthew Henry Concise (`mhcc`) | 27 950 | 24 656 | **3 294** | **88,21 %** |

Pour la question immédiate : **ACBC est presque terminé ; Barnes a encore un trou significatif mais borné.** Les compléter représente 2 501 segments au total. Ces chiffres remplacent le premier comptage exploratoire : celui-ci limitait chaque sous-collection à 20 documents et masquait 61 commentaires dans des versets très chargés. Le contrôle final utilise une requête Firestore filtrée exactement sur `resource.code`, puis un `batchGet` de chaque identifiant français. MHCC est moins complet dans le cache générique, mais ce chiffre ne doit pas être confondu avec la ressource française `mhy-fr` fournie par Dominique, qui a son propre découpage de 4 145 unités.

Les [manifestes reproductibles du prototype](../../apps/resource-studio/workflows/commentaries/data/audit/summary.json) donnent chaque identifiant et passage initialement manquant. La QA heuristique a signalé 51 traductions ACBC et 53 Barnes ; les nettoyages et traductions par lots ont ensuite complété les corpus. Aucun identifiant source dupliqué ou passage syntaxiquement invalide n'a été trouvé. Ces alertes servent à cibler les corrections, sans créer un état éditorial distinct. La clé DeepL historique présente dans l'environnement a été refusée par l'API pendant l'audit ; aucune traduction payante n'a été lancée.

Cette mesure prouve la présence d'un document français portant le même identifiant, pas sa qualité éditoriale. Le mécanisme actuel :

- lit `commentaries-FR/{id}` et, en cas d'absence, appelle DeepL depuis le client puis écrit seulement `{ content }` ;
- ne stocke ni code de corpus, ni hash du texte anglais, ni moteur/version, ni date de traduction ;
- autorise actuellement l'écriture publique anonyme sur toute la collection dans les règles Firestore.

Le cache ne peut donc pas devenir la base canonique tel quel. Avant SQL/SQLite, il faut fermer l'écriture publique, rattacher chaque traduction à une révision source et contrôler contenu vide, langue réelle, HTML, fidélité et dérive du texte anglais. La traduction à la volée avec DeepL ne doit pas rester la solution de publication : elle est non reproductible. Les 747 segments ACBC et 1 754 segments Barnes initialement manquants ont depuis été produits en lots traçables et publiés dans le prototype JSON.

## Matrice des meilleurs candidats

### Ressources prêtes ou presque prêtes

| Ressource | Langue et couverture | Source et formats | Droits vérifiés | Qualité et maintenance | Aptitude PostgreSQL / SQLite |
|---|---|---|---|---|---|
| **Tyndale Open Study Notes — Aquifer** | EN : 16 923 unités ; FR : 16 922 dans la source auditée, complétées à 16 923 dans le prototype ; 66 livres protestants dans les deux langues. Beaucoup d'unités couvrent des plages, pas un seul verset. | [Dépôt officiel Aquifer](https://github.com/BibleAquifer/AquiferOpenStudyNotes), JSON, Markdown, PDF. Inventaire officiel : [Aquifer Full Inventory](https://github.com/BibleAquifer/docs/blob/main/aquifer_full_inventory.md). | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Adaptation permise, attribution, indication des changements et ShareAlike obligatoires. | Dépôt actif ; instantané inspecté `d67935dcc1e81e1d6d40c5cdd8cf38addb107767` du 25 août 2026. HTML interne et liens de ressources normalisés dans le prototype. | **Excellente.** JSON déjà structuré, identifiants et passages présents. Publier EN et FR comme ressources/révisions séparées sous BY-SA ; ne pas dupliquer les plages par verset. |
| **Albert Barnes Notes** | EN, Nouveau Testament seulement. | [Fiche CrossWire](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Barnes), module SWORD zCom ; paquet brut `rawzip/Barnes.zip` depuis le [miroir officiel](https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Barnes.zip). | `DistributionLicense=Public Domain` dans la configuration officielle. | Version 1.1, ancienne mais stable. Le texte est historique ; vérifier ponctuation, caractères et références. Déjà présent dans le Firestore historique, ce qui permet un diff de migration. | **Bonne.** Structure verse-key directement convertible. Conserver l'édition et le hash du module ; ne pas annoncer une couverture « whole Bible ». |
| **Jamieson-Fausset-Brown** | EN, 66 livres protestants. | [Fiche CrossWire JFB](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=JFB), zCom, paquet [JFB.zip](https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/JFB.zip). | Domaine public selon la fiche/module ; édition 1871. | Version SWORD 3.0 (2021), corpus historique compact et continu. Perspective protestante du XIXe siècle à étiqueter. | **Très bonne.** Bon deuxième commentaire anglais complet, ingestion verse-key simple. |
| **Matthew Henry Concise — anglais** | EN, 66 livres protestants. | [Fiche CrossWire MHCC](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=MHCC), zCom, [MHCC.zip](https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/MHCC.zip). Une autre source est [CCEL](https://www.ccel.org/ccel/henry/mhc.toc.html). | Original anglais dans le domaine public. Cela ne couvre **pas** la traduction française de 2010. | Module 2.0 (2021) ; CrossWire signale la correction d'environ 1 200 erreurs de l'ancienne copie électronique. CCEL est utile pour recouper l'édition. | **Très bonne** en anglais. Identité distincte de `mhy-fr`; aucun lien de « traduction autorisée » ne doit être inféré. |
| **Matthew Henry Complete — anglais** | EN, 66 livres protestants, beaucoup plus volumineux. | [Fiche CrossWire MHC](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=MHC), [MHC.zip](https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/MHC.zip) ; [CCEL MHC](https://ccel.org/h/henry/mhc2/MHC00000.HTM). | Original anglais dans le domaine public ; la page CCEL le marque sans droits réservés. Certains rendus PDF de CCEL peuvent avoir leurs propres mentions : préférer le module ou le XML/HTML explicitement ouvert. | Version SWORD 2.2 (2022). Œuvre riche mais très volumineuse, langue ancienne et structure parfois plus large que le verset. | **Bonne**, mais seconde vague en raison du volume. Conserver titres, introductions et unités supra-versets. |
| **Commentaires de saint Augustin — français** | FR, collection patristique ; couverture partielle et non continue à mesurer livre par livre. | [Fiche CrossWire FreAug](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=FreAug), traduction Poujoulat/Raulx 1864–1872, [FreAug.zip](https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/FreAug.zip). | Domaine public déclaré par le module ; ancienneté de l'édition cohérente. Conserver les crédits exacts de traduction. | Version 1.1 (2023). Exégèse patristique de grande valeur, mais pas un commentaire verset par verset moderne. Une vérification d'OCR est nécessaire. | **Bonne** si le produit accepte des unités partielles et des plages. Publier avec une carte de couverture explicite. |
| **Commentaires de saint Jean Chrysostome — français** | FR, homélies/commentaires patristiques, couverture partielle. | [Fiche CrossWire FreChry](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=FreChry), [FreChry.zip](https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/FreChry.zip). | Domaine public déclaré par le module. | Version 2.2 du 29 janvier 2026 : module récemment maintenu. Qualité d'OCR et découpage versets à échantillonner. | **Bonne**, mêmes réserves que FreAug ; excellent complément francophone, pas ressource principale continue. |
| **Rachi sur le Tanakh — anglais** | EN, Torah et reste du Tanakh ; pas de Nouveau Testament. | [Exports officiels Sefaria](https://github.com/Sefaria/Sefaria-Export), JSON/TXT et liens ; licences/version dans [Sefaria Lite Sources and Licenses](https://lite.sefaria.org/sources-and-licenses). | Traduction Metsudah 2009 pour la Torah et Judaica Press/A. J. Rosenberg pour le reste : **CC BY** selon Sefaria. Sélectionner la version exacte, jamais un export `merged`. | Export structuré, mensuel et fortement maintenu. Tradition juive indispensable pour diversifier le catalogue. La licence est au niveau de chaque version/langue ; certaines versions hébraïques ont une licence inconnue. | **Excellente** après sélecteur de version et mapping Tanakh/canon. Attribution et indication des changements obligatoires. |
| **Calvin Commentaries — anglais** | EN, nombreux livres AT/NT mais pas le canon entier. | [Collection CCEL](https://ccel.org/ccel/calvin/commentaries) en ThML/XML, HTML, texte et autres formats ; [fiche d'édition d'un volume](https://www.ccel.org/c/calvin/comment3/comm_vol31/htm/About.htm). Également [module CrossWire](https://crosswire.org/sword/modules/ModInfo.jsp?modName=CalvinCommentaries). | CCEL marque les fichiers électroniques historiques comme domaine public et fournit traducteur/transcripteur/édition. | Bonne provenance éditoriale ; structure riche mais conversion versets moins triviale en ThML. CrossWire accélère l'indexation ; CCEL sert de source de contrôle. | **Bonne**, seconde vague. Garder l'unité originale et un index de passages plutôt que fragmenter le texte. |

### Ressources utiles mais conditionnelles

| Ressource | Valeur | Pourquoi elle n'est pas immédiatement admissible |
|---|---|---|
| **Keil & Delitzsch** | Commentaire anglais détaillé de l'Ancien Testament, [module CrossWire KD](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=KD), domaine public déclaré. | La fiche indique une préparation issue d'un module BibleWorks créé par un utilisateur. Il faut conserver cette chaîne de provenance, comparer un échantillon à une édition imprimée et quantifier les erreurs avant publication. |
| **Adam Clarke** | Commentaire anglais complet, domaine public, [module CrossWire Clarke](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Clarke). Déjà présent dans Firestore. | Techniquement prêt, mais volumineux, théologiquement situé et probablement redondant avec les premiers choix. Très bon candidat de migration après le registre des droits et un diff exhaustif. |
| **Wesley Notes** | 66 livres, concis, domaine public, [module CrossWire Wesley](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Wesley). | Facile à intégrer, mais moins prioritaire que JFB/Barnes pour le premier lot. |
| **Treasury of David** | Commentaire classique des Psaumes, domaine public, [module CrossWire TDavid](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=TDavid). | Psaumes uniquement et très volumineux ; excellent pack thématique ultérieur. |
| **Catena Aurea** | Anthologie patristique anglophone sur les quatre Évangiles ; domaine public dans [le catalogue CrossWire](https://www.crosswire.org/sword/modules/ModDisp.jsp?exp=true&modType=Commentaries). | Couverture Évangiles seulement ; vérifier l'édition/traduction précise du module avant ingestion. Bonne voix catholique/patristique en seconde vague. |
| **Annotations originales Douay-Rheims** | Dépôt JSON `janvier-s/original-douay-rheims` épinglé au commit `0bf4218b9b46b5b00d29a703b5b74226051b97a5`, CC0 1.0. Les 1 659 objets effectivement publiés sont importés sur 390 chapitres et 53 livres avec contenu. | Le JSON publié est accepté comme source faisant foi, sans collation, reconstruction ni restauration éditoriale par Bible Strong. |
| **Haydock** | Grand commentaire catholique anglais historiquement dans le domaine public. | Aucun dépôt structuré avec provenance éditoriale et déclaration de droits suffisamment robustes n'a été identifié. [Une édition EPUB communautaire existe](https://johnblood.gitlab.io/haydock/id2.html), mais ne doit pas entrer en production avant vérification de l'édition, des transcripteurs et des éventuels ajouts. |
| **Family 35 NT with Commentary** | Traduction anglaise du NT et notes de Wilbur Pickering, formats de développement et SWORD sur [eBible](https://ebible.org/bible/details.php?id=engf35). | La [page de copyright actuelle](https://ebible.org/engf35/copyright.htm) indique CC BY-SA 4.0, mais la [préface](https://ebible.org/engf35/FRT01.htm) mentionne CC BY-SA 3.0. Demander une clarification, puis étiqueter clairement sa perspective textuelle Family 35/Byzantine. |
| **unfoldingWord Translation Notes** | Notes de traduction très structurées, TSV, [dépôt officiel](https://git.door43.org/unfoldingWord/en_tn), sous CC BY-SA 4.0. La [release v90](https://git.door43.org/unfoldingWord/en_tn/releases) couvre les 27 livres NT et 29 livres AT. | Ce sont des aides à la traduction, pas un commentaire général. La branche mouvante comportait des travaux explicitement marqués AI ; épingler une release stable et faire une QA humaine. Les dépôts français sont fragmentés entre organisations/forks et leur maturité doit être auditée séparément. |
| **Bible Annotée de Neuchâtel** | Candidat français historique majeur, avec Bonnet/Bovet/Godet et une large couverture ; [lecture en ligne](https://www.lueur.org/bible/version/annotee-neuchatel.html). | Aucun jeu de données structuré avec licence de réutilisation et provenance numérique primaire n'a été trouvé. Ne pas scraper le site. Il faut établir l'édition exacte, les dates de décès de tous les contributeurs et les droits de la transcription numérique, ou refaire un OCR depuis une édition imprimée libre. |

## Sources à ne pas ingérer sans contrat propre

### NET Bible / Bible.org

La NET Bible est une ressource remarquable, avec environ 60 000 notes de traduction, d'étude et de critique textuelle, mais elle n'est pas une ressource ouverte au sens nécessaire ici. Les [téléchargements officiels](https://bible.org/downloads), le [service API](https://labs.bible.org/api_web_service) et les [conditions de permission](https://bible.org/permissions) permettent certains usages de lecture, personnels ou encadrés ; ils n'accordent pas une permission générale d'extraire, transformer, réhéberger et redistribuer toute la base de notes dans un SQLite. Le module `NETnotesfree` de CrossWire est lui aussi marqué copyrighted et limité.

**Décision :** lien externe ou négociation directe avec Bible.org. Aucun chargement canonique ni cache hors ligne sans contrat couvrant explicitement ces usages.

### Free Bible Commentary / Bob Utley

Le site [Free Bible Commentary en français](https://freebiblecommentary.org/french_bible_study.htm) offre une couverture impressionnante en PDF. « Free » décrit l'accès, pas les droits. Un [volume français officiel](https://www.freebiblecommentary.org/pdf/fre/VOL04A_french.pdf) porte le copyright de Bible Lessons International, « all rights reserved », et interdit la reproduction sans permission écrite. Les citations bibliques incluses peuvent en plus provenir de traductions protégées.

**Décision :** ne pas extraire. Demander une licence écrite pour l'ensemble du corpus et de ses traductions, ou proposer seulement un lien externe.

### Modules CrossWire à permission limitée

`FreCJE` (*Chaque jour les Écritures*) est indiqué « Copyrighted; Permission to distribute granted to CrossWire ». `RWP`, `KingComments`, `NETnotesfree` et plusieurs autres modules sont sous copyright ou réservés à un usage non commercial. La [FAQ CrossWire](https://www.crosswire.org/faq/) rappelle que les droits dépendent des modules ; le fait que CrossWire puisse distribuer un fichier ne transfère pas cette permission à Bible Strong.

**Décision :** seuls les modules dont la configuration donne un droit compatible — idéalement `Public Domain`, CC0, CC BY ou CC BY-SA — passent le filtre automatique. Toute mention spécifique à CrossWire part en revue juridique manuelle.

### Internet Archive et Gallica

Internet Archive est une plateforme de dépôt. La disponibilité d'un PDF ou de son OCR n'est pas une preuve que l'uploader détenait les droits, ni que la transcription est réutilisable. Un item ne peut être retenu que si le statut de l'œuvre, de la traduction et de l'édition numérique est vérifié séparément. Lorsqu'un dépôt éditorial primaire existe, il doit être préféré.

Gallica est excellente pour établir une édition historique, mais les conditions de réutilisation de la reproduction numérique doivent être respectées. La [BnF indique](https://www.bnf.fr/fr/faire-une-utilisation-commerciale-dune-reproduction) que la réutilisation non commerciale de reproductions d'œuvres du domaine public est libre sous conditions d'attribution, tandis qu'un usage commercial — notamment dans un produit ou une grande base documentaire — nécessite autorisation et redevance. Les [données bibliographiques de la BnF](https://www.bnf.fr/fr/conditions-de-reutilisations-des-donnees-de-la-bnf) ont un régime plus ouvert, mais cela ne rend pas les images/OCR librement exploitables commercialement.

**Décision :** utiliser IA/Gallica pour recherche, collation et preuve bibliographique. Pour un corpus de production, obtenir une licence de la reproduction ou repartir d'un exemplaire imprimé du domaine public avec OCR et correction propres.

## Plateformes qui ne fournissent pas, en elles-mêmes, un corpus de commentaire

### eBible.org

[eBible.org](https://ebible.org/) est principalement un distributeur de traductions bibliques. Sa [présentation du domaine public](https://ebible.org/publicdomain.htm) explique correctement qu'un texte réellement dans le domaine public peut être copié, adapté et redistribué, mais les droits restent propres à chaque œuvre. Hormis des éditions contenant des notes — comme Family 35 — eBible n'est pas un catalogue de commentaires comparable à CrossWire. Les formats USFM/USX/HTML/SWORD sont utiles seulement lorsque la page de droits de l'œuvre visée autorise l'usage.

### STEP Bible Data

Le [dépôt officiel STEPBible-Data](https://github.com/STEPBible/STEPBible-Data) est sous CC BY 4.0 et fournit des TSV de lexique, morphologie, noms propres, versification et textes étiquetés. C'est une excellente source d'enrichissement et de correspondance, mais **pas un corpus de commentaires**. Les commentaires visibles dans l'interface STEP viennent de modules ou d'éditeurs tiers et gardent leurs droits propres. Certains champs conceptuels ou descriptions du dépôt sont signalés comme générés avec Claude 3 ; ils doivent être considérés comme non révisés jusqu'à preuve contraire.

### Open Scriptures

[Open Scriptures](https://github.com/openscriptures) et [MorphHB](https://github.com/openscriptures/morphhb) fournissent notamment le Westminster Leningrad Codex en OSIS, avec texte du WLC dans le domaine public et annotations morphologiques sous CC BY 4.0. C'est utile pour les langues originales et l'alignement, mais ce n'est pas un commentaire biblique.

### Wycliffe / unfoldingWord « Bible Commentary »

Certaines pages intitulées *Bible Commentary*, par exemple [le commentaire de Matthieu](https://doc-files.bibleineverylanguage.org/en-bc-mat_lbo_1c_c_chapter.html), sont sous CC BY-SA et reprennent largement des questions-réponses issues des Translation Notes. Elles ne doivent pas être comptées comme un grand corpus exégétique indépendant. Elles peuvent être publiées plus tard comme aide à la traduction, avec leur provenance et leur type de ressource corrects.

## Mesures détaillées d'Aquifer

L'instantané vérifié est le commit `d67935dcc1e81e1d6d40c5cdd8cf38addb107767` du 25 août 2026, version de métadonnées 1.1.2.

| Mesure | Anglais | Français |
|---|---:|---:|
| Livres | 66 | 66 |
| Entrées | 16 923 | 16 922 |
| Taille des JSON | ~25 MB | ~25 MB |
| Caractères de contenu | ~6,70 M | ~6,82 M |
| Estimation de mots | ~805 902 | ~861 179 |
| Entrées sur un seul verset | 10 637 | 10 635 |
| Entrées sur une plage | 6 286 | 6 287 |

Ces chiffres montrent que le modèle ne doit pas supposer « un document = un verset ». Les articles contiennent du HTML, des listes de passages, des identifiants `content_id`, des dates source, des ressources liées et parfois des liens `ref.ly`/`data-resourceId`. La normalisation doit conserver ces relations ou les convertir vers des liens internes stables.

## Traduire : droits, coût et méthode

### Ce qui est légalement traduisible

- Une œuvre anglaise réellement dans le domaine public peut être traduite. La nouvelle traduction devient toutefois une œuvre protégée distincte ; il faut un contrat avec le traducteur ou une licence de contribution qui autorise à Bible Strong la publication, la modification, la base SQL, l'API et le SQLite.
- Une œuvre sous CC BY peut être traduite avec attribution, lien de licence et indication des modifications.
- Une œuvre sous CC BY-SA peut être traduite, mais la traduction est une adaptation et doit être proposée sous la même licence. Le [texte juridique CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/legalcode) traite aussi les droits sur les bases de données. Il faut pouvoir livrer l'attribution et la licence avec le pack.
- Un texte gratuit, « tous droits réservés », `NC`, `ND` ou seulement autorisé à un distributeur ne peut pas être traduit et publié sans permission supplémentaire.

### Ne pas traduire tout le catalogue

Aquifer apporte déjà environ 861 000 mots français couvrant 66 livres. Il est donc rationnel de publier cette ressource, de mesurer l'usage et de traduire ensuite seulement les œuvres ou passages qui apportent une vraie diversité.

MHC, Clarke, Barnes ou Keil & Delitzsch représentent chacun un chantier important. Avant de lancer un nouveau corpus, l'importeur doit produire le compte exact de mots uniques après suppression du balisage et sans multiplier les passages couvrant plusieurs versets. La priorité peut ensuite être déterminée par l'intérêt éditorial et les signalements d'utilisateurs.

### Pipeline de traduction recommandé

1. Épingler l'œuvre, l'édition, le hash et la licence source.
2. Segmenter selon les paragraphes et plages originales, jamais arbitrairement par verset.
3. Produire la traduction en lot avec glossaire biblique, noms propres et politique de citations.
4. Valider automatiquement l'identité de la source, la langue, la structure HTML et les références bibliques.
5. Stocker pour chaque segment la source anglaise, la traduction, le moteur/modèle et sa version, la date et le profil de production.
6. Publier une révision immuable et indiquer clairement « traduction Bible Strong », l'édition source et les modifications.
7. Corriger les segments concernés lorsqu'une anomalie est détectée ou signalée par un utilisateur, puis republier les artefacts.

Pour Matthew Henry Concise français, obtenir une licence de l'édition CLÉ pourrait rester moins coûteux qu'une retraduction complète, si les conditions sont compatibles.

## Architecture de données recommandée

L'architecture doit respecter les ADR du dépôt : PostgreSQL est la source canonique publiée ; SQLite est un artefact généré, validé et remplaçable. Une ressource est indépendante de son canal de livraison.

### Identité et révisions

Une identité d'œuvre ne doit pas contenir la langue ni la révision. Exemple conceptuel :

```text
commentary_work
  id, slug, original_title, authors, tradition, original_language,
  first_publication, description

commentary_edition
  id, work_id, language, edition_title, translators, publisher,
  source_url, source_locator, source_sha256, source_version,
  license_spdx_or_status, license_url, rights_holder,
  attribution_text, modification_notice, rights_evidence_url,
  canon, versification, editorial_status

commentary_revision
  id, edition_id, revision, imported_at, importer_version,
  content_sha256, entry_count, coverage_manifest, status

commentary_unit
  id, revision_id, source_id, title, body_html, body_text,
  sort_order, source_created_at, source_modified_at

commentary_unit_passage
  unit_id, book, chapter_start, verse_start,
  chapter_end, verse_end, source_reference, mapping_status
```

Le commentaire est stocké une seule fois dans `commentary_unit`. `commentary_unit_passage` l'indexe sur un ou plusieurs passages. Copier le même paragraphe sur chaque verset gonflerait PostgreSQL/SQLite, casserait les statistiques de traduction et rendrait les corrections difficiles.

### Packs SQLite

Produire de préférence **un pack par édition et langue**, ou un petit bundle explicitement compatible, plutôt qu'une base géante :

- les obligations CC BY-SA restent isolables et lisibles ;
- l'utilisateur télécharge seulement les œuvres voulues ;
- les révisions et invalidations sont indépendantes ;
- les droits peuvent évoluer sans remplacer tout le catalogue.

Chaque SQLite doit contenir :

- les unités, leurs passages et éventuellement une table FTS ;
- la métadonnée complète d'œuvre, d'édition et de révision ;
- le texte d'attribution, la licence et l'avis de modification hors ligne ;
- la carte de couverture et le schéma de versification ;
- les hashes de contenu et le contrat de schéma ;
- aucune URL active ou HTML non assaini qui puisse exécuter du contenu.

Les plages source doivent rester les plages source. Une table d'index peut rendre une unité accessible depuis chaque verset couvert sans recopier son corps.

### Porte automatique de droits

L'importeur devrait bloquer la publication si un champ requis manque :

```text
admis automatiquement : PublicDomain, CC0-1.0, CC-BY-4.0
admis avec politique ShareAlike : CC-BY-SA-4.0
revue manuelle : licence personnalisée, permission écrite
refusé : NC, ND, CrossWire-only, copyrighted, unknown, champ absent
```

Une capture ou copie textuelle des conditions, son URL, sa date d'accès et son hash doivent accompagner chaque révision. Cela protège contre une page web modifiée ultérieurement.

## Contrôles qualité avant publication

Pour chaque import :

1. vérifier le hash et la version de la source ;
2. vérifier licence, traduction et provenance numérique séparément ;
3. comparer les nombres d'unités avant/après import et par livre ;
4. produire la couverture livres/chapitres/versets et les trous ;
5. détecter références invalides, plages inversées et problèmes de versification ;
6. contrôler doublons, balises résiduelles, entités HTML, encodage, liens externes et scripts ;
7. échantillonner au minimum début/milieu/fin de chaque livre contre la source ;
8. vérifier que les introductions et titres ne sont pas perdus ;
9. générer PostgreSQL et SQLite depuis la même révision, puis comparer compteurs et hashes logiques ;
10. tester recherche, ordre canonique, passage sur plage, affichage hors ligne, attribution et licence ;
11. publier un manifeste machine-readable et un rapport humain de validation.

Pour une migration Firestore, ajouter un diff par `(œuvre, langue, passage)` : contenu identique, corrigé, absent, nouveau, ou droits inconnus. Les corpus EGW/SDA doivent faire l'objet d'un audit de droits distinct ; leur présence actuelle ne permet aucune conclusion.

## Plan de livraison proposé

### Phase 0 — assainissement des droits

- Archiver l'accord Osché de 2019 et ses pièces jointes ; corriger `mhy-fr` de `Public domain` vers une permission personnalisée dont la portée est documentée.
- Demander une confirmation complémentaire seulement pour les usages non explicités dans le courriel historique, notamment le commercial et la redistribution autonome du SQLite.
- Inventorier chaque identifiant Firestore (`acbc`, `barnes`, `mhcc`, EGW…) avec source, édition, langue, titulaire, licence et preuve.
- Fermer immédiatement l'écriture publique anonyme de `commentaries-FR` et exporter un instantané horodaté avant nettoyage.
- Introduire la porte de droits et le manifeste de provenance avant d'ajouter un nouveau corpus.

### Phase 1 — premier catalogue démontrable

- Importer Aquifer/Tyndale EN et FR depuis le commit épinglé.
- Publier Aquifer français avec sa provenance et corriger ensuite les anomalies détectées ou signalées.
- Importer Barnes EN depuis CrossWire et comparer avec Firestore.
- Importer JFB EN pour une couverture complète indépendante.
- Importer FreAug et FreChry FR avec cartes de couverture.
- Générer un SQLite par édition/langue et vérifier la parité avec PostgreSQL.

Ce lot offre immédiatement une ressource moderne complète dans chaque langue, deux classiques anglais et deux voix patristiques françaises. Il satisfait mieux l'objectif produit qu'une retraduction massive préalable.

### Phase 2 — diversité et migration

- Migrer Adam Clarke et MHCC anglais après diff et contrôle de provenance.
- Conserver les traductions ACBC et Barnes désormais complètes dans le prototype JSON comme contenu français publiable ; les 747 absences ACBC et 1 754 absences Barnes ont été comblées en lots traçables.
- Ajouter Rachi anglais depuis des versions Sefaria explicitement CC BY.
- Douay-Rheims est importé depuis le JSON publié, sans QA de collation avec les fac-similés conformément à la décision éditoriale du projet.
- Décider si les Translation Notes forment un type de ressource distinct.
- Négocier, si la demande utilisateur le justifie, NET Bible, Bob Utley ou la traduction française CLÉ de MHCC.

### Phase 3 — programme français patrimonial

- Choisir une œuvre à forte valeur, probablement la Bible Annotée de Neuchâtel.
- Établir juridiquement chaque édition et contributeur.
- Acquérir une reproduction réutilisable ou numériser un exemplaire propre.
- OCR, correction, segmentation et mapping de références.
- Publier le texte français historique avant d'envisager de nouvelles traductions intégrales de commentaires anglais.

## Points à éclaircir avant décision finale

- L'accord Osché retrouvé peut-il être archivé avec les fichiers originaux et complété par une confirmation explicite pour SQL, API, SQLite, corrections et usage commercial éventuel ?
- D'où proviennent exactement les corpus Firestore `acbc`, `barnes`, `mhcc` et EGW, et ont-ils été modifiés ?
- Bible Strong est-il ou pourra-t-il être considéré comme un usage commercial ? La porte de droits doit être conçue pour le scénario le plus large.
- L'équipe accepte-t-elle de distribuer les adaptations Aquifer sous CC BY-SA 4.0 et de rendre les fichiers de ressource correspondants récupérables sous cette licence ?
- Quelles traditions et quels canons le catalogue doit-il représenter explicitement : protestant, catholique, orthodoxe, juif, adventiste ?
- Les anciens commentaires seront-ils affichés avec date, tradition, auteur, langue d'origine et avertissement de vocabulaire historique ?
- Le produit veut-il un « commentaire » unique par verset ou accepte-t-il correctement les introductions, homélies, unités multi-versets et commentaires de livre ? Le second modèle est nécessaire pour ne pas dégrader les sources.
- Quelle version de versification devient la référence canonique, et comment les deutérocanoniques seront-ils adressés ?
- Pour Family 35, quelle version CC BY-SA fait foi : 3.0 dans la préface ou 4.0 dans la page de copyright actuelle ?

## Recommandation finale

La décision raisonnable aujourd'hui est de sécuriser le corpus existant, publier Aquifer EN/FR avec sa licence, puis ajouter les œuvres dont les droits et la provenance sont établis.

Le premier ensemble produit peut être **Aquifer EN/FR + ACBC EN/FR + Barnes EN/FR**, car il correspond au besoin immédiat et à l'historique de Bible Strong. JFB apporte en complément une couverture anglaise complète. L'accord Osché retrouvé permet de conserver Matthew Henry français dans le programme ; il faut archiver la preuve, corriger sa fausse mention `Public domain` et clarifier les extensions d'usage futures. La Bible Annotée, Rachi, Calvin et les ressources catholiques forment ensuite un programme crédible de diversification, sans confondre disponibilité sur le Web et liberté de redistribution.

# Corpus RAG bibliques : sources, licences et stratégie d'ingestion

Date de recherche : 21 août 2026

Portée : assistant Bible Strong entièrement en ligne, fondé sur des sources

Statut : recommandation technique et éditoriale, pas un avis juridique

## Résumé exécutif

Le modèle peut utiliser sa connaissance interne pour comprendre une question, reformuler, classer une intention et rédiger. Il ne devrait pas l'utiliser comme source invisible pour une affirmation biblique, historique, lexicale ou doctrinale présentée comme vraie. OpenAI rappelle que les modèles produisent encore des affirmations plausibles mais fausses et recommande de favoriser l'abstention plutôt que la supposition ([OpenAI, « Why language models hallucinate »](https://openai.com/index/why-language-models-hallucinate/)).

Pour Bible Strong, la règle produit recommandée est donc :

> Le LLM apporte la langue et le raisonnement ; les corpus apportent les faits et les citations.

Il existe un noyau ouvert et techniquement très exploitable : Bibles du domaine public, textes hébreu et grec, données STEPBible, ressources déjà normalisées par Bible Aquifer, notes unfoldingWord, renvois OpenBible, géographie OpenBible/Pleiades et Wikidata. En revanche, il n'existe pas de corpus unique, historiquement complet, multiconfessionnel et juridiquement simple que l'on puisse « brancher » tel quel.

La langue source n'est pas une contrainte forte. Bible Strong peut rechercher dans le meilleur corpus anglais, grec ou hébreu, puis répondre en français. Il est préférable de traduire seulement les extraits effectivement récupérés plutôt que de prétraduire toute la bibliothèque. Le système doit néanmoins conserver l'extrait source, afficher sa provenance et évaluer séparément la fidélité de la traduction française.

Le volume n'est pas le principal problème. Une première version utile peut tenir dans quelques dizaines de milliers de segments textuels et quelques centaines de milliers de relations structurées. Le vrai travail est de :

1. vérifier les droits ressource par ressource et édition par édition ;
2. conserver la provenance et l'attribution jusque dans chaque segment ;
3. séparer faits structurés, textes sources, commentaires et interprétations ;
4. évaluer la qualité et la perspective éditoriale ;
5. n'envoyer au fournisseur IA que les quelques extraits nécessaires à une réponse.

## 1. Quand autoriser la connaissance interne du LLM ?

### 1.1 Usages acceptables sans RAG

La connaissance paramétrique du modèle peut être utilisée pour des opérations qui ne prétendent pas apporter une nouvelle preuve externe :

- comprendre et normaliser la question en français ou en anglais ;
- détecter une référence biblique écrite de manière approximative ;
- classer la demande : passage, Strong, histoire, doctrine, méditation, hors sujet ;
- produire une requête de recherche, sélectionner des filtres et organiser un plan de réponse ;
- résumer ou reformuler exclusivement les extraits fournis ;
- traduire en français un petit ensemble de sources récupérées, avec conservation du texte source ;
- proposer des questions d'observation ou de méditation qui n'ajoutent pas de faits ;
- expliquer qu'une question est ambiguë ou demander une précision.

Dans ces usages, le modèle est un moteur linguistique et de composition, pas une base documentaire.

### 1.2 Usages qui doivent être fondés sur des sources récupérées

Le RAG ou une résolution exacte doit être obligatoire pour :

- citer ou paraphraser un passage biblique ;
- donner une date, un lieu, une coutume ou un événement historique ;
- expliquer un lemme, une morphologie, une étymologie ou un sens Strong ;
- attribuer une position à un auteur, une Église ou une tradition ;
- comparer des canons ou des interprétations doctrinales ;
- affirmer qu'un texte « signifie » quelque chose ;
- mentionner une découverte archéologique, un manuscrit ou une variante textuelle ;
- répondre à une question pastorale sensible en s'appuyant sur l'Écriture.

Le système ne devrait pas demander au modèle : « réponds avec tes connaissances et ajoute des références ». Un modèle peut fabriquer des références aussi facilement qu'un autre fait ([OpenAI, fiabilité et fausses citations](https://help.openai.com/en/articles/8313428-chatgpt-and-fake-citations)). Les identifiants de sources doivent venir du serveur et la réponse ne doit pouvoir citer que cette liste autorisée.

### 1.3 Politique de réponse conseillée

Trois statuts explicites suffisent pour le MVP :

- `answered_from_sources` : les affirmations sont soutenues par les segments récupérés ;
- `contested` : les sources ou traditions divergent et la réponse les nomme ;
- `insufficient_sources` : Bible Strong ne possède pas encore de source suffisante.

On peut techniquement ajouter plus tard un encart « connaissance générale du modèle, non vérifiée ». Il est déconseillé dans la première version : l'utilisateur distinguera mal une phrase issue d'une source éditoriale d'une phrase issue des poids du modèle.

## 2. « Open source », « domaine public », « accessible » : trois choses différentes

### 2.1 Domaine public ou CC0

Le texte peut en principe être copié, adapté, indexé et redistribué sans demander une licence de copyright. Il faut encore vérifier les marques, l'intégrité de l'édition numérique et le droit applicable. eBible explique par exemple les libertés attachées à ses Bibles du domaine public, tout en rappelant qu'un nom de traduction peut rester une marque ([eBible, Public Domain](https://ebible.org/publicdomain.htm)).

### 2.2 Licence ouverte

Une ressource CC BY autorise l'usage commercial et l'adaptation, mais exige l'attribution. Une ressource CC BY-SA ajoute une obligation de partage à l'identique lorsqu'une adaptation est publiquement partagée.

Creative Commons confirme que les licences 4.0 accordent les droits nécessaires à l'extraction et à la fouille de données lorsque le droit d'auteur ou le droit sui generis est impliqué. Pour une approche prudente de l'IA, CC recommande l'attribution liée à la sortie RAG et avertit que des sorties fondées sur du contenu ShareAlike peuvent devoir être distribuées sous la même licence ([FAQ Creative Commons sur les bases de données](https://creativecommons.org/faq/), [guide CC et entraînement IA](https://creativecommons.org/using-cc-licensed-works-for-ai-training-2/)).

Conséquence pratique : privilégier domaine public, CC0 et CC BY pour le MVP. Mettre les sources CC BY-SA dans un canal séparé tant que la politique d'attribution, de licence des sorties et de redistribution n'a pas été validée.

### 2.3 Accessible gratuitement, API ou dépôt GitHub

La gratuité de lecture ou de téléchargement n'accorde pas automatiquement le droit de créer des embeddings, d'envoyer le texte à OpenAI, de générer des adaptations ou de redistribuer des extraits.

Deux pièges fréquents :

- CrossWire précise que beaucoup de modules lui sont licenciés uniquement pour sa propre distribution ; une autre application doit obtenir sa propre permission ([FAQ CrossWire](https://www.crosswire.org/faq/)). Il faut lire `DistributionLicense` de chaque module, pas seulement la licence du moteur SWORD.
- Un dépôt GitHub sous MIT peut regrouper des textes qui conservent chacun leur propre copyright. La licence du code de conversion ne « libère » pas les Bibles contenues dans le dépôt.

Une licence actuelle autorisant Bible Strong à afficher une traduction ou un commentaire hors ligne ne doit pas être supposée couvrir :

1. l'embedding ;
2. le transfert d'extraits à un fournisseur IA ;
3. la création de résumés ou traductions ;
4. l'affichage de citations dans une sortie générée ;
5. la rétention ou l'entraînement par le fournisseur.

## 3. Cartographie des corpus réutilisables

### 3.1 Textes bibliques français et anglais

| Corpus | Statut | Format et aptitude RAG | Réserves éditoriales |
|---|---|---|---|
| [Louis Segond 1910 sur eBible](https://ebible.org/bible/details.php?id=fraLSG) | Domaine public déclaré par eBible | USFM et plusieurs formats développeur ; excellent pour résolution exacte et recherche française | Français ancien et tradition protestante ; ne représente pas toutes les traditions |
| [Bible J. N. Darby](https://ebible.org/bible/details.php?id=frajnd) | Domaine public, source indiquée par l'éditeur BPC | texte par chapitre, SWORD, XML ; excellente | numérotation de l'édition 2024 à mapper explicitement |
| Ostervald 1744 / Martin 1744 | Domaine public dans le catalogue eBible/CrossWire | bons formats mais langue ancienne | surtout utiles comme comparaison historique |
| [World English Bible](https://ebible.org/find/details.php?id=engwebp) | Domaine public | USFM ; moderne et complète ; excellente base anglaise | le nom « World English Bible » reste protégé ; renommer une version modifiée |
| [Open English Bible](https://ebible.org/engoebus/FRT01.htm) | sans restriction de copyright déclarée par le projet | texte moderne, mais Ancien Testament encore incomplet selon l'édition | ne pas en faire l'unique base canonique |

eBible offre USFM, USFX, SQL et texte verset-par-ligne selon les permissions de chaque traduction ([formats eBible](https://ebible.org/about.php)). Il faut importer une édition épinglée et sa notice de droits, pas aspirer le catalogue entier.

Bible Strong possède déjà de nombreuses traductions. Pour la recherche sémantique, il n'est pas nécessaire d'embarquer quarante fois le même contenu dans l'index vectoriel. Recommandation :

- une base sémantique française ouverte, par exemple LSG 1910 ;
- une base sémantique anglaise ouverte, par exemple WEB ;
- les textes hébreu et grec structurés ;
- au moment de l'affichage, résolution exacte dans la traduction sélectionnée par l'utilisateur si sa licence autorise cet usage.

Cela évite que quarante traductions quasi identiques saturent les meilleurs résultats.

### 3.2 Hébreu, grec, morphologie et Strong

| Corpus | Licence | Contenu | Aptitude RAG |
|---|---|---|---|
| [Open Scriptures Hebrew Bible](https://github.com/openscriptures/morphhb) | texte WLC domaine public ; lemmes et morphologie CC BY 4.0 | OSIS XML, identifiants de mots stables, lemmes, morphologie, Strong étendus | excellente ; préférer les requêtes structurées aux embeddings pour les formes exactes |
| [SBL Greek New Testament](https://github.com/LogosBible/SBLGNT) | CC BY 4.0 | texte grec critique en fichiers structurés | excellente ; choix éditorial du SBLGNT à afficher clairement |
| [MACULA Greek](https://github.com/Clear-Bible/macula-greek) | jeu principal CC BY 4.0, avec composants tiers documentés | syntaxe, morphologie, sens, cadres sémantiques, participants | très riche mais plus complexe ; vérifier les sous-composants avant ingestion |
| [STEPBible Data](https://github.com/STEPBible/STEPBible-Data/blob/master/README.md) | CC BY 4.0, crédit « STEP Bible » | textes amalgamés, lexiques Strong étendus, morphologie, variantes, noms propres, versifications | meilleur noyau structuré pour le MVP lexical |

Les jeux STEPBible sont distribués en texte UTF-8 séparé par tabulations. Le dépôt documente notamment :

- `TAHOT` : hébreu, morphologie et tags sémantiques ;
- `TAGNT` : grec NT et variantes entre éditions ;
- `TBESH` et `TBESG` : lexiques brefs liés aux Strong étendus ;
- `TFLSJ` : lexique grec LSJ formaté ;
- `TIPNR` : personnes, lieux, formes hébraïques/grecques et relations ;
- `TVTMS` : correspondances de versification.

Point de vigilance : le README indique que certaines descriptions longues de `TIPNR` et certains groupes conceptuels ont eux-mêmes été produits avec Claude. Ils peuvent servir de candidats ou de métadonnées, mais pas de source historique validée sans revue humaine ([inventaire officiel STEPBible](https://github.com/STEPBible/STEPBible-Data/blob/master/README.md)).

Les entrées lexicales ne doivent pas être uniquement vectorisées. Conserver une table exacte avec : identifiant Strong, lemme, langue, formes, morphologie, sens, glosses, références et provenance. L'embedding sert seulement à trouver une entrée depuis une question naturelle.

### 3.3 Notes culturelles, historiques et linguistiques

La source la plus directement prête pour un POC RAG est probablement l'organisation officielle [Bible Aquifer](https://github.com/BibleAquifer). Elle publie des ressources déjà normalisées en JSON et Markdown, avec identifiants stables, métadonnées, associations de passages, liens entre ressources et associations ACAI.

Deux corpus sont particulièrement intéressants :

- [Aquifer Open Study Notes](https://github.com/BibleAquifer/AquiferOpenStudyNotes), adaptation des _Tyndale Open Study Notes_, sous CC BY-SA 4.0 ;
- [Aquifer Open Bible Dictionary](https://github.com/BibleAquifer/AquiferOpenBibleDictionary), adaptation du _Tyndale Open Bible Dictionary_, sous CC BY-SA 4.0.

L'[inventaire officiel Aquifer](https://github.com/BibleAquifer/docs/blob/main/aquifer_full_inventory.md), consulté et daté du 6 janvier 2026, indique :

- 16 922 notes d'étude anglaises et 16 914 françaises, soit 99 % de la couverture annoncée ;
- 6 103 articles du dictionnaire anglais et 2 713 articles français, soit 44 % ;
- 66 introductions et 66 résumés d'introduction de livres en français.

Aquifer distribue aussi les [UBS Dictionary of the Greek New Testament](https://github.com/BibleAquifer/UBSGreekNTDictionary) et [UBS Dictionary of Biblical Hebrew](https://github.com/BibleAquifer/UBSHebrewDictionary), sous CC BY-SA 4.0, avec localisations dont le français. Les [schémas JSON officiels](https://github.com/BibleAquifer/docs/tree/main/schemas) rendent ces ressources beaucoup plus faciles à ingérer qu'une collection de pages web.

Limite essentielle : des échantillons actuels portent `review_level: "None"`. Cela ne signifie pas nécessairement que le texte source n'a jamais été édité, mais que le statut de revue exposé par Aquifer ne permet pas d'en déduire une validation pour Bible Strong. Il faut donc auditer les métadonnées, échantillonner la qualité et attribuer un statut interne avant de présenter ces notes comme vérifiées.

Une autre ressource prête à l'emploi est [unfoldingWord Translation Notes](https://git.door43.org/unfoldingWord/en_tn). Les notes sont segmentées par passage, disponibles en TSV, et expliquent notamment les implicites, figures de style et éléments culturels ou linguistiques. [Translation Words](https://git.door43.org/unfoldingWord/en_tw) fournit des articles thématiques reliés au texte. Bible Aquifer republie également plusieurs ressources unfoldingWord dans son schéma commun.

Ces ressources sont en CC BY-SA 4.0. Elles sont techniquement excellentes pour le RAG, mais :

- la version anglaise est généralement la plus complète et peut être utilisée directement comme source de récupération ;
- des ressources françaises existent sur Door43, mais plusieurs proviennent de communautés différentes et avec des niveaux de vérification différents ;
- toute traduction ou synthèse publiée doit être examinée au regard du ShareAlike ;
- elles ont une finalité première de traduction biblique, pas d'encyclopédie historique universitaire exhaustive.

Pour la première version commerciale, deux options sont raisonnables :

1. utiliser ces notes dans un canal CC BY-SA clairement attribué et juridiquement validé ;
2. s'en servir comme matériau de découverte pour rédiger un petit corpus éditorial propre à Bible Strong, en revenant aux sources autorisées et sans copier une adaptation non compatible.

Il n'est donc pas nécessaire d'attendre un corpus entièrement français. Une requête française peut utiliser des embeddings multilingues ou être traduite en requête anglaise, récupérer une note anglaise, puis produire une réponse française sourcée. La traduction étant elle-même une adaptation, les obligations CC BY-SA restent applicables lorsque la sortie est publiquement partagée.

Il n'existe pas, dans les sources examinées, d'équivalent moderne et complet de « toute l'histoire du monde biblique » sous une licence permissive unique. Pour une bonne qualité, Bible Strong devra probablement :

- licencier une ressource éditoriale contemporaine ; ou
- créer progressivement des fiches historiques relues, sourcées et versionnées ; ou
- commencer avec un périmètre modeste : lieux, peuples, institutions, coutumes et chronologie de base.

### 3.4 Commentaires, dictionnaires et histoire de l'interprétation

CrossWire offre plusieurs modules individuellement déclarés dans le domaine public :

- [Matthew Henry, commentaire complet](https://crosswire.org/sword/modules/ModInfo.jsp?modName=MHC), environ 15 Mo installé ;
- [Adam Clarke](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Clarke), environ 8,5 Mo ;
- [commentaires de Calvin](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=CalvinCommentaries), environ 21 Mo ;
- [Treasury of Scripture Knowledge](https://www.crosswire.org/sword/modules/ModInfo.jsp?beta=true&modName=TSK), domaine public et environ 500 000 références annoncées par l'édition ;
- dictionnaires anciens tels qu'Easton ou Smith, sous réserve de vérifier le module exact.

Ces œuvres sont utiles pour l'histoire de l'interprétation et comme voix protestantes historiques. Elles ne doivent pas être présentées comme le consensus historique ou exégétique contemporain. Chaque segment doit porter auteur, date, tradition et type de ressource.

En français, les ressources ouvertes prêtes pour le RAG sont nettement plus rares. Bible Strong possède déjà Nave, le dictionnaire Westphal et des commentaires : leurs droits doivent être audités à partir du contrat ou de la provenance exacte. L'ancienneté apparente d'un livre ou sa présence dans une application ne suffit pas à établir son domaine public en France.

### 3.5 Renvois, thèmes et relations bibliques

[OpenBible.info](https://www.openbible.info/) publie environ 340 000 renvois et annonce, sauf indication contraire, une licence CC BY. Le jeu brut est téléchargeable et comprend un score issu des votes ([présentation officielle des renvois](https://www.openbible.info/blog/2010/04/new-in-labs-cross-references/)).

Ces données sont un graphe, pas un corpus textuel :

```text
source_verse -> target_verse, score, provenance
```

Elles doivent rester dans PostgreSQL et être traversées par requête. Il est inutile et moins fiable de convertir chaque relation en phrase puis de l'embedder. Attention à ne pas importer avec elles les citations ESV affichées sur le site : OpenBible précise séparément que ces citations appartiennent à Crossway.

Nave et TSK peuvent compléter ce graphe, mais il faut conserver leur perspective éditoriale et leur provenance, puis évaluer la pertinence des relations sur un jeu français.

### 3.6 Géographie et chronologie

| Corpus | Licence | Ce qu'il apporte | Limites |
|---|---|---|---|
| [OpenBible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data) | CC BY 4.0 ; images sous licences variables | lieux bibliques, références, hypothèses concurrentes, coordonnées, scores de confiance, JSON Lines | canon protestant annoncé ; ne pas importer les images sans vérifier chaque licence |
| [Pleiades](https://pleiades.stoa.org/downloads) | CC BY 3.0 | gazetteer universitaire du monde antique ; dumps JSON, CSV, KML, RDF | plus large que la Bible ; lier les identifiants plutôt que dupliquer les descriptions |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata%3ALicensing) | données structurées CC0 | personnes, dates, royaumes, identifiants externes, relations | qualité hétérogène ; les références de chaque assertion doivent être vérifiées |

OpenBible Geocoding est particulièrement intéressant parce qu'il conserve les identifications possibles et leur degré d'incertitude, au lieu de forcer une seule coordonnée. Le dépôt contient des fichiers JSONL et documente les sources et scores ([documentation du dépôt](https://github.com/openbibleinfo/Bible-Geocoding-Data)).

Wikidata est adapté à la création de candidats et de liens, pas à la rédaction automatique d'un fait historique. Une date extraite de Wikidata devrait rester attachée à l'assertion et à ses références, puis être validée avant publication.

### 3.7 Sources antiques et archéologie

Des textes de Josèphe, Philon et d'auteurs gréco-romains peuvent enrichir le contexte. Perseus propose des téléchargements XML pour certains textes du domaine public, mais indique que le statut des matériaux varie et interdit l'usage commercial non autorisé de certains composants ([politique Perseus](https://www.perseus.tufts.edu/hopper/help/copyright.jsp)). Il ne faut donc pas aspirer Perseus en bloc : homologuer chaque édition et chaque traduction.

Une source antique est une source primaire historique, pas automatiquement un fait exact ni un consensus moderne. Elle doit être citée comme témoignage de son auteur et accompagnée, quand nécessaire, d'une fiche éditoriale expliquant ses limites.

## 4. Sources riches mais non importables automatiquement

### Sefaria

Sefaria est une plateforme ouverte très riche, mais chaque texte, édition et traduction peut avoir une licence différente. Une API publique ou un export ne constitue pas une licence globale. N'ingérer que des éditions explicitement listées comme domaine public ou compatibles avec l'usage commercial et l'IA.

### CrossWire, CCEL et dépôts agrégateurs

Ils sont d'excellents catalogues et formats de distribution, mais pas des licences uniformes. Les modules « permission de distribuer accordée à CrossWire » ne sont pas réutilisables par Bible Strong sans permission séparée.

### Traductions commerciales et API bibliques

Les limites de citation ou une API gratuite sont généralement destinées à l'affichage, pas à la construction d'un corpus IA. La politique de [Biblica](https://www.biblica.com/publisher-ai-policy/) impose désormais une licence explicite pour l'usage IA et des contrôles sur le transfert, la reconstruction du texte et la supervision humaine. Les traductions Biblica présentes dans Bible Strong doivent rester hors du pipeline jusqu'à autorisation écrite.

### Wikipédia

Wikipédia offre une couverture immense, mais sous CC BY-SA, avec une qualité et des perspectives variables. Pour Bible Strong, l'utiliser comme outil de découverte ou source de liens est plus prudent que d'en faire l'autorité finale du RAG biblique.

## 5. Corpus de départ recommandé

### Voie A — POC juridiquement simple

1. Louis Segond 1910 et World English Bible pour la recherche sémantique.
2. Open Scriptures Hebrew Bible et SBLGNT pour les textes originaux.
3. STEPBible `TBESH`, `TBESG`, morphologie et versification.
4. OpenBible Cross References.
5. OpenBible Geocoding, complété par Pleiades.
6. Un sous-ensemble Wikidata vérifié pour personnes, royaumes et dates.
7. Un petit corpus éditorial Bible Strong de fiches historiques relues.

Cette voie reste essentiellement domaine public, CC0 ou CC BY.

### Voie B — le meilleur POC fonctionnel après validation ShareAlike

Ajouter :

- Aquifer Open Study Notes et Aquifer Open Bible Dictionary en priorité ;
- dictionnaires grec et hébreu UBS distribués par Aquifer ;
- unfoldingWord Translation Notes et Translation Words ;
- ressources françaises Door43 retenues après revue de qualité ;
- commentaires et dictionnaires anciens du domaine public, étiquetés par tradition ;
- sources antiques homologuées édition par édition.

### Ce que ce corpus permet déjà

- retrouver des passages depuis une question en langage naturel ;
- produire un résumé d'un chapitre avec citations exactes ;
- expliquer un Strong avec lemme, morphologie et usages contextuels ;
- afficher les renvois et thèmes liés ;
- présenter les lieux et les incertitudes géographiques ;
- répondre à des questions historiques simples lorsque la fiche correspondante existe ;
- s'abstenir proprement dans les autres cas.

Si Bible Strong accepte et met correctement en œuvre le CC BY-SA, la voie B est le meilleur point de départ produit : Aquifer évite une grande partie du travail de parsing et fournit déjà presque toutes les notes Tyndale en français. Si la question ShareAlike n'est pas résolue, commencer avec la voie A et un corpus éditorial plus petit.

## 6. Taille opérationnelle : ce n'est pas « énormément de données »

Ordres de grandeur de planification, à confirmer par un prototype :

| Ensemble | Représentation recommandée | Ordre de grandeur |
|---|---|---|
| une Bible | 31 000 versets, regroupés en péricopes ou fenêtres | 5 000 à 10 000 chunks |
| hébreu + grec | tokens et lemmes structurés | moins d'un million de tokens, requêtes SQL exactes |
| Strong étendu | une entrée/sens par segment | environ 10 000 à 20 000 entrées |
| renvois OpenBible | table d'arêtes | environ 340 000 relations, aucun embedding nécessaire |
| commentaires sélectionnés | sections liées aux passages | quelques dizaines de milliers de segments |
| géographie | entités et relations | quelques milliers de lieux bibliques |
| fiches historiques MVP | fiches éditoriales | 500 à 2 000 fiches peuvent déjà couvrir les sujets fréquents |

Un MVP de 50 000 à 100 000 embeddings est ordinaire pour PostgreSQL/pgvector. Selon la dimension des vecteurs et l'index, cela représente typiquement de quelques centaines de mégaoctets à quelques gigaoctets, pas des téraoctets. Les fichiers source et les index doivent néanmoins être mesurés sur le prototype.

Le principe d'économie est : ne pas embedder ce qui est déjà une clé, une relation ou une référence exacte.

## 7. Modèle de droits obligatoire

Avant toute ingestion, créer un registre des droits :

```text
source_id
work_title
edition
author_or_editor
canonical_url
license_id
required_attribution
commercial_use_allowed
derivatives_allowed
share_alike
provider_transfer_allowed
embedding_allowed
generated_summary_allowed
quote_limit
territory_or_contract_notes
editorial_perspective
resource_revision
checksum
reviewed_by
reviewed_at
```

Un champ inconnu vaut `false`, pas « probablement autorisé ». Les règles doivent être héritées par tous les segments et appliquées avant récupération : une ressource non transférable ne doit jamais apparaître dans le contexte envoyé au fournisseur.

## 8. Pipeline d'ingestion conseillé

### Étape 1 — acquisition reproductible

- télécharger une release ou un commit épinglé ;
- conserver le fichier de licence et la notice d'attribution ;
- calculer un checksum ;
- enregistrer la version et l'URL canonique ;
- rejeter les agrégats dont les droits ne sont pas déterminables par élément.

### Étape 2 — normalisation sans perdre la structure

Schéma conceptuel :

```text
resource_source
  id, title, edition, author, license, attribution, perspective, revision

resource_segment
  id, source_id, type, language, canonical_ref, hierarchy_path,
  text, metadata, review_status

resource_relation
  from_segment_or_entity, relation_type, to_segment_or_entity,
  weight, source_id

resource_embedding
  segment_id, embedding_model, chunker_version, vector, created_at
```

Les versets, tokens, Strong, personnes, lieux et renvois restent dans leurs tables métier. `resource_segment` sert à la recherche textuelle et au dossier envoyé au modèle.

### Étape 3 — segmentation par domaine

- Bible : péricope connue ou fenêtres de 3 à 10 versets, sans couper une structure poétique si possible ;
- note : ligne TSV ou note liée à sa plage exacte ;
- lexique : un sens ou une sous-section, relié à l'entrée principale ;
- commentaire : paragraphe ou section, lié aux versets commentés ;
- histoire : une fiche factuelle courte avec ses références ;
- lieu/personne : données structurées et courte description relue.

Ne jamais fusionner dans un même chunk des œuvres, licences ou traditions différentes.

### Étape 4 — indexation

- index lexical PostgreSQL pour noms, références, translittérations et citations exactes ;
- pgvector seulement pour les champs sémantiques ;
- graphe relationnel pour Strong, renvois, personnes et lieux ;
- filtres par langue, canon, type de source, tradition, époque, droits et statut de revue ;
- versionner les embeddings par modèle, chunker et révision de la source.

Pour les langues, deux stratégies doivent être benchmarkées :

- embeddings multilingues : la question française et les documents anglais partagent le même index ;
- traduction de requête : le modèle produit une requête anglaise contrôlée, puis la recherche utilise l'index anglais.

Dans les deux cas, la réponse française conserve les `source_ids`, l'extrait dans sa langue d'origine et, si affichée, une traduction marquée comme telle. Il n'est pas nécessaire de prétraduire et de stocker tout le corpus.

### Étape 5 — récupération et réponse

1. résoudre d'abord toute référence exacte ;
2. récupérer les données structurées correspondantes ;
3. lancer la recherche hybride uniquement pour les parties ouvertes ;
4. reranker un petit ensemble ;
5. envoyer 5 à 10 extraits, chacun avec un identifiant de citation ;
6. obliger le modèle à produire un JSON avec assertions et `source_ids` ;
7. vérifier côté serveur que chaque source existe et était dans le dossier ;
8. afficher l'attribution et un lien vers la ressource.

Le fournisseur IA ne reçoit donc jamais « toutes les Bibles et tous les commentaires ». Pour une réponse donnée, il reçoit quelques kilo-octets ou dizaines de kilo-octets de contexte pertinents.

## 9. Décisions à prendre avant le prototype

1. Les sorties fondées sur CC BY-SA peuvent-elles être publiées sous CC BY-SA dans l'interface Bible Strong ?
2. Quelles traductions actuellement distribuées ont explicitement des droits IA, embeddings et transfert fournisseur ?
3. Quelle base sémantique française ouverte choisir : LSG 1910 seule ou LSG + une seconde traduction autorisée ?
4. Quelle perspective éditoriale attribuer aux notes et commentaires ?
5. Qui valide les 500 premières fiches historiques ?
6. Le fournisseur choisi garantit-il contractuellement absence d'entraînement et rétention compatible avec les licences ?

## Conclusion

La stratégie habituelle n'est pas de donner une bibliothèque immense au LLM ni de lui faire confiance « de mémoire ». Elle consiste à construire une bibliothèque relativement petite mais bien structurée, avec une provenance et des droits explicites, puis à ne fournir au modèle que le dossier utile à chaque question.

Pour Bible Strong, le bon premier corpus existe déjà à environ 70 % sous forme ouverte. Le manque principal n'est ni la Bible, ni Strong, ni les renvois, ni la géographie : c'est un corpus historique moderne, francophone, équilibré et éditorialement validé. Cette partie doit être créée progressivement ou licenciée, et non remplacée silencieusement par la mémoire du modèle.

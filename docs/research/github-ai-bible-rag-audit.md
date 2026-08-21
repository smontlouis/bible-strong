# Projets GitHub IA biblique : audit RAG, corpus et garde-fous

> Recherche arrêtée au 21 août 2026. Périmètre : projets et ressources GitHub directement inspectables, au-delà de STEPBible (déjà intégré à Bible Strong) et de Bible Aquifer. Les constats de licence portent sur les fichiers présents dans les dépôts ; ils ne constituent pas un avis juridique.

## Conclusion

Il n’existe pas aujourd’hui de « RAG biblique open source prêt pour la production » que Bible Strong pourrait simplement déployer. Les meilleurs projets apportent chacun une brique différente :

1. **TheologAI** est la meilleure référence pour la provenance des sources, les contrats d’outils, la recherche diversifiée et les états d’erreur explicites. Certains de ses textes historiques du domaine public peuvent devenir des candidats à l’ingestion, après audit édition par édition.
2. **Claude of Alexandria** est la meilleure référence pour les garde-fous épistémiques et la méthode d’évaluation RED/GREEN, mais pas pour son code GPL ni comme autorité théologique neutre.
3. **bible-rag** est le prototype le plus instructif pour mesurer une recherche hybride dense + lexicale + reranking. Ses résultats montrent qu’un reranker peut aider, tandis que l’expansion de requête par LLM coûte beaucoup pour un gain faible.
4. **Scripture Recall** contient un excellent principe produit : le modèle renvoie des identifiants de versets, puis l’application insère elle-même le texte biblique exact.
5. **BibleMate Agentic Workspace** est une référence intéressante pour découper une étude longue en phases et rendre les textes bibliques exacts depuis une base structurée. Ce n’est toutefois ni un RAG sourcé ni une base de production réutilisable : ses garde-fous sont principalement des prompts, ses corpus ne sont pas auditables depuis le dépôt et son modèle de permissions est trop large.
6. **context-grounded-bible / mybibletoolbox-data** proposent une convention de fichiers par verset et par source, mais aucun moteur RAG. Le dépôt de données actuel présente des défauts de provenance, de licence et d’intégrité qui interdisent une ingestion directe.

La recommandation est donc de **construire le RAG de Bible Strong dans l’infrastructure existante**, en empruntant des patrons précis à ces projets, et non de forker un chatbot existant ou de dépendre d’un MCP public anonyme.

## Classement et décision

| Rang | Projet | Apport réel | Maturité observée | Décision Bible Strong |
|---:|---|---|---|---|
| 1 | [TheologAI](https://github.com/TJ-Frederick/TheologAI) | Provenance, recherche FTS structurée, outils MCP typés, limites et statuts explicites | Actif, nombreux tests et audits de données ; corpus encore limité | **Réutiliser les concepts et certains schémas ; évaluer les textes un par un** |
| 2 | [Claude of Alexandria](https://github.com/davebream/claude-of-alexandria) | Garde-fous exégétiques, niveaux de confiance, controverses, évaluations RED/GREEN | Actif et bien documenté ; évaluations encore dépendantes de juges LLM | **Référencer ; ne pas forker sans accepter la GPL-3.0** |
| 3 | [bible-rag](https://github.com/calebyhan/bible-rag) | RAG hybride, RRF, reranking, jeu de 40 requêtes et métriques de retrieval | Prototype sérieux, mais sécurité/citations/licences des Bibles non production | **Porter les idées et l’eval, pas le dépôt complet** |
| 4 | [Scripture Recall](https://github.com/Clear-Bible/scripture-recall) | Références générées puis texte exact inséré depuis la base | Hackathon ancien, sans licence, clé OpenAI côté client | **Réutiliser uniquement le patron fonctionnel** |
| 5 | [BibleMate Agentic Workspace](https://github.com/eliranwong/biblemate-agentic-workspace) | Orchestration par phases, outils SQLite, versets déterministes, artefacts intermédiaires | Jeune projet mono-mainteneur, sans release, licence absente, presque aucune eval de fond | **Référencer le workflow ; ne reprendre ni le code, ni les données, ni la sécurité** |
| 6 | [Awesome Bible NLP](https://github.com/BibleNLP/awesome-bible-nlp) | Catalogue de corpus, alignements et outils multilingues | Catalogue maintenu, pas un corpus ni un RAG | **Référencer pour la découverte ; auditer chaque source originale** |
| 7 | [studybible-mcp](https://github.com/djayatillake/studybible-mcp) | Bonne taxonomie d’outils d’étude biblique et exemples de chaînage | Démo active ; tests superficiels et licences de corpus incomplètes | **Référencer l’UX seulement ; éviter ses contenus ANE/théologiques** |
| 8 | [BibleTopics](https://github.com/Clear-Bible/BibleTopics) | Graphe pondéré thème → verset potentiellement utile comme signal faible | Petit projet, données bruyantes, aucune licence trouvée | **Ne pas ingérer sans permission explicite** |
| 9 | [bible-ai-assistant](https://github.com/t-timms/bible-ai-assistant) | Catalogue utile de modes d’échec et quelques contrôles API | Alpha ; performances faibles et documentation contradictoire | **Éviter le modèle et le fine-tuning ; garder les catégories de tests** |
| 10 | [context-grounded-bible](https://github.com/authenticwalk/context-grounded-bible) / [mybibletoolbox-data](https://github.com/authenticwalk/mybibletoolbox-data) | Convention YAML par verset/source et reconditionnement de Macula, TBTA, eBible et Strong | Aucun RAG ; données corrompues par endroits, provenance/licences insuffisantes, aucune eval | **Référencer le format seulement ; ne forker ni le moteur ni les données** |

## 1. TheologAI : la meilleure base conceptuelle

TheologAI n’est pas un chatbot complet et ne fait pas de RAG sémantique : c’est surtout un serveur d’outils de preuve fondé sur SQLite/FTS et déployable sur Cloudflare Workers/D1. Cette limitation est aussi sa force : la frontière entre recherche de sources et génération reste claire.

Éléments réutilisables :

- entrées et sorties JSON strictes, avec tailles, nombre de requêtes et nombre de résultats bornés ;
- distinction entre `ok`, `no_results`, `unavailable`, `disabled`, `rate_limited`, `interface_changed` et autres états, au lieu de laisser le modèle improviser quand une source manque ;
- requêtes FTS composées comme littéraux, sans exposer directement la syntaxe de recherche à l’utilisateur ;
- diversification par œuvre : un premier résultat par œuvre avant d’en prendre un deuxième, ce qui évite qu’un seul auteur monopolise le contexte ;
- identifiants et localisateurs stables (`documentId`, section, ordinal, URI de ressource), attribution et état de l’édition ;
- modèle de droits distinguant l’œuvre abstraite, l’édition/transcription exacte, le territoire, l’attribution, les modifications, les obligations de partage et le hash de l’artefact ;
- télémétrie sans contenu par défaut, limites de requête, allowlists de routes/méthodes/origines et limitation de débit.

Le [modèle de provenance](https://github.com/TJ-Frederick/TheologAI/blob/main/src/kernel/editionProvenanceFoundation.ts), le [SQL de recherche diversifiée](https://github.com/TJ-Frederick/TheologAI/blob/main/src/adapters/shared/primarySourceSearchSql.ts), le [service de recherche historique](https://github.com/TJ-Frederick/TheologAI/blob/main/src/services/historical/PrimarySourceSearchService.ts) et le [manifeste du corpus “core eight”](https://github.com/TJ-Frederick/TheologAI/blob/main/data/historical-source-packs/core-eight/manifest.json) sont les fichiers les plus directement utiles.

Le dépôt contient des confessions et des textes historiques normalisés : Irénée, Athanase, Augustin, Anselme, Jean Damascène, Calvin, Bunyan, Wesley, ainsi que d’autres auteurs patristiques et modernes. Le manifeste fournit souvent URL d’acquisition, édition et hash. Toutefois, la mention interne `no_known_conflict` n’est pas une garantie juridique ; Bible Strong doit vérifier indépendamment l’édition précise et ne pas supposer que le scan source est redistribuable parce que l’œuvre sous-jacente est dans le domaine public.

**Décision :** reprendre la structure de provenance, les contrats d’outils et la diversification. Pour le corpus, constituer une liste blanche d’éditions approuvées puis importer depuis les sources primaires épinglées, pas depuis un service MCP public.

## 2. Claude of Alexandria : garde-fous et évaluations

Ce projet Claude/MCP applique une approche historico-grammaticale explicitement protestante. Il n’est donc pas une doctrine neutre à intégrer telle quelle. En revanche, plusieurs garde-fous sont très pertinents :

- collecter les preuves avant de rédiger, plutôt que rédiger de mémoire puis chercher une confirmation ;
- distinguer faits linguistiques, conclusions de discours, positions savantes et appréciation du modèle ;
- exprimer la confiance par affirmation : `HIGH`, `MEDIUM`, `LOW`, `CANNOT ANSWER` ;
- présenter les deux côtés des sujets signalés comme controversés, sans déclarer artificiellement un vainqueur ;
- vérifier les limites de la péricope, le genre, le contexte et l’alliance avant l’interprétation ;
- recontrôler après génération un petit nombre d’affirmations à haut risque ;
- utiliser des verdicts structurés : étayé, compatible, non étayé, preuves insuffisantes.

Le projet documente [136 scénarios d’évaluation](https://github.com/davebream/claude-of-alexandria/blob/main/tests/promptfoo/README.md), dont des cas RED reproduisant des erreurs du modèle nu et des cas GREEN vérifiant les garde-fous. Il reconnaît lui-même le biais d’un juge de la même famille de modèles, emploie aussi des assertions structurelles et conserve quelques échecs connus. C’est une bonne méthodologie de départ, pas une preuve de sûreté absolue.

Son [NOTICE de données](https://github.com/davebream/claude-of-alexandria/blob/main/server/NOTICE.md) est également exemplaire par les réserves qu’il énonce : sources non épinglées, licences distinctes, identifications contestées, interprétations christologiques dans certaines annotations, etc.

**Décision :** adapter ces catégories dans un benchmark propre à Bible Strong, enrichi de cas catholiques, orthodoxes, protestants, juifs, deutérocanoniques et de formulations françaises. Ne pas copier le code ou les skills dans un produit non GPL sans revue de compatibilité, car le dépôt est sous GPL-3.0.

## 3. bible-rag : résultats mesurés d’une recherche hybride

L’architecture associe PostgreSQL/pgvector, recherche plein texte, embeddings `multilingual-e5-large`, fusion RRF, reranker `bge-reranker-v2-m3`, Redis et éventuellement expansion de requête par LLM.

Son [rapport d’évaluation](https://github.com/calebyhan/bible-rag/blob/main/backend/eval/REPORT.md) mesure 40 requêtes manuellement annotées, en anglais, coréen et cross-lingue :

| Configuration | Recall@10 | MRR | NDCG@10 | Latence moyenne |
|---|---:|---:|---:|---:|
| Sémantique seule | 0,156 | 0,289 | 0,155 | 1 169 ms |
| Hybride RRF | 0,153 | 0,273 | 0,147 | 950 ms |
| Hybride + reranker | 0,198 | 0,310 | 0,185 | 2 635 ms |
| + expansion LLM | 0,210 | 0,315 | 0,192 | 8 215 ms |

Le jeu est petit, mais les conclusions sont utiles : l’hybride ne gagne pas automatiquement ; le reranking améliore ici le NDCG d’environ 26 % au prix d’une latence presque triplée ; l’expansion LLM n’ajoute qu’environ 4 % de NDCG avec plus de trois fois la latence du reranking. Le [jeu de requêtes](https://github.com/calebyhan/bible-rag/blob/main/backend/eval/queries.json) est un bon modèle de format, pas un benchmark suffisant pour Bible Strong.

Points à ne pas reprendre :

- les « citations » sont principalement des références bibliques détectées par expression régulière dans le texte généré, sans preuve serveur que le passage cité faisait partie des sources récupérées ;
- le prompt autorise du contexte historique/culturel alors que la recherche apporte surtout versets et données lexicales, ce qui invite le modèle à compléter depuis sa mémoire ;
- le streaming commence avant validation finale ;
- l’authentification, la modération et la limitation de débit ne sont pas de niveau production ;
- le dépôt évoque l’ingestion de traductions modernes protégées via des API gratuites : disponibilité par API ne signifie pas droit de stockage, d’embedding ou de redistribution.

**Décision :** implémenter la même expérimentation dans Neon/Postgres, mais exiger que toute citation soit un identifiant de source récupéré et validé côté serveur. Pour le MVP, mesurer le reranker ; ne pas adopter l’expansion LLM par défaut.

## 4. studybible-mcp : taxonomie utile, corpus à écarter

La taxonomie d’outils est intéressante : passage, étude de mot, Strong, renvois, entités, généalogie, lieux, notes, dictionnaire, termes clés, passages similaires et contexte culturel. Elle peut nourrir la conception des outils typés exposés au modèle.

En revanche, son corpus « Ancient Near East » et théologique ne doit pas être présenté comme un corpus historique factuel. Des contenus inspectés inscrivent comme cadre implicite :

- la méthodologie de Michael Heiser, le « divine council », l’heureglass et les Watchers ;
- l’inerrance et des conclusions confessionnelles rassurantes ;
- des lectures anti-modernes ou anti-occidentales ;
- des critiques de modèles de l’expiation et de traditions réformées formulées comme contexte plutôt que comme position interprétative.

Les références bibliographiques ne suffisent pas à assurer une provenance au niveau de chaque affirmation, et certains résumés semblent dérivés de livres contemporains protégés sans droit de redistribution documenté. La [licence MIT](https://github.com/djayatillake/studybible-mcp/blob/main/LICENSE) du code ne re-licencie pas les corpus : elle ne documente explicitement que STEPBible, alors que le README mentionne aussi Aquifer et d’autres jeux de données aux conditions distinctes.

La solidité des tests est faible au regard des promesses : `test_all_tools.py` vérifie surtout que les réponses ne sont pas vides ou contiennent quelques sous-chaînes, avec des skips quand les embeddings manquent ; `test_tool_selection.py` utilise un score de mots-clés maison, pas un vrai modèle ; le comparatif Ollama est manuel. Il n’y a pas d’évaluation robuste de fidélité aux citations, de neutralité théologique ou de red-team.

**Décision :** réutiliser la taxonomie et les idées d’enchaînement seulement. Ne pas forker le corpus ANE/théologique et ne pas dépendre du endpoint anonyme. Si Aquifer est retenu, l’importer depuis sa source primaire avec sa licence CC BY-SA et sa provenance propre.

## 5. BibleMate Agentic Workspace : bon workflow d’étude, mauvais socle de production

Le dépôt [BibleMate Agentic Workspace](https://github.com/eliranwong/biblemate-agentic-workspace) est avant tout un ensemble de configurations pour Google Antigravity, Claude Code et Grok Build : environ 125 skills/commandes, 15 personas, des scripts Python de lecture SQLite et un orchestrateur qui sauvegarde chaque étape dans des fichiers Markdown. Il ne contient ni service RAG autonome ni corpus principal ; les bases sont téléchargées séparément par `biblematedata`.

### Ce que l’architecture fait réellement

Le [workflow principal](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/biblemate/SKILL.md) déroule planification, récupération locale, exégèse, synthèse théologique, application, aperçu puis rédaction/audit. Les résultats intermédiaires sont persistés, ce qui limite la pression sur la fenêtre de contexte et permet une reprise. L’inventaire des skills est découvert dynamiquement. Ce sont de bons patrons pour un futur mode « étude approfondie » asynchrone de Bible Strong.

La couche factuelle réellement déterministe est plus étroite que le README ne le suggère :

- le [retriever biblique](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/bible/bible_retriever.py) parse une référence, sélectionne une traduction puis exécute des requêtes SQLite paramétrées ;
- le [retriever de commentaires](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/commentary/commentary_retriever.py) récupère des entrées par livre/chapitre/verset ;
- la [recherche biblique](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/search/search_retriever.py) charge les versets puis applique des expressions régulières avec opérateurs simples, limitée à l’affichage des 100 premiers résultats.

Il n’y a dans le workspace aucun pipeline d’embedding, indexation vectorielle, retrieval sémantique, reranking, attribution par chunk ou évaluation de retrieval. Le package de données télécharge bien des fichiers nommés `vectors/*.db`, mais aucun code du workspace inspecté ne les utilise. Appeler ce projet un RAG serait donc trompeur : c’est une **orchestration agentique sur outils de lookup**, suivie de nombreuses étapes génératives.

Le point le plus réutilisable est la règle « ne jamais citer un verset de mémoire ». Elle est inscrite dans les [règles globales des personas](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/agents.md#L1-L6). Bible Strong doit en faire une propriété technique plus forte : le modèle renvoie des références structurées, le serveur vérifie qu’elles appartiennent aux résultats de l’outil, puis Postgres fournit le texte exact.

### Où la provenance et les citations s’arrêtent

La règle universelle sécurise seulement la reproduction du texte biblique, et encore au niveau du prompt. Elle ne sécurise pas les affirmations exégétiques ou historiques. Les skills [OT context](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/ot-context/SKILL.md) et [NT context](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/nt-context/SKILL.md) donnent au modèle une liste de sujets à développer, sans corpus historique, recherche obligatoire ni sources académiques. Leur consigne « citer livre, chapitre et verset pour toutes les affirmations » ne constitue pas une citation historique.

De même, le commentaire récupéré est étiqueté par un code de module, mais la sortie ne transporte pas systématiquement auteur, titre, édition, licence, identifiant de ligne ou URL primaire. Le workflow demande ensuite au modèle d’intégrer et d’attribuer des observations : rien ne permet au serveur de vérifier cette attribution. Les liens produits par le skill `online` sont également synthétisés par l’agent sans allowlist de sources, snapshot, hash, délimitation « données non fiables » ou défense documentée contre les instructions présentes dans une page récupérée.

Le dépôt applique une lecture confessionnelle évangélique/protestante explicite : autorité finale de l’Écriture, Christocentrisme, repentance/conversion, opposition entre vision biblique et concepts séculiers. Cette position peut être proposée comme une perspective clairement nommée, mais ne doit pas devenir un contexte historique « neutre ». Les scripts de référence [codent en dur 66 livres](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/bible/bible_retriever.py#L8-L22), sans deutérocanoniques.

### Corpus et licences : pas de chaîne de confiance exploitable

Aucun fichier `LICENSE`, `NOTICE`, SBOM ou manifeste de droits n’a été trouvé dans le workspace, et GitHub ne détecte aucune licence. En l’absence d’autorisation explicite, il ne faut donc pas copier/forker le code pour Bible Strong.

Les données principales ne sont pas versionnées dans ce dépôt. Le package séparé [`biblematedata`](https://github.com/eliranwong/biblematedata) télécharge des archives opaques depuis Google Drive. Son [script de téléchargement](https://github.com/eliranwong/biblematedata/blob/168baf3d746db759b591bb92671b1bb0bea46d0c/package/biblematedata/main.py) énumère NET, LEB, ISV, BSB, KJV, de nombreux commentaires, lexiques, encyclopédies, bases vectorielles et données dérivées, mais ne fournit ni licence par fichier, ni URL source primaire, ni version d’édition, ni hash d’intégrité. Le `setup.py` qualifie le package de GPL ; cela ne re-licencie pas les traductions, commentaires ou données tierces qu’il télécharge. La licence GPL de UniqueBible couvre son code, pas automatiquement chaque module de contenu.

Le petit registre local de témoignages illustre le même problème : son [JSON](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/testimony/data/testimonies.json) contient des récits rédigés et des références parfois limitées à une page éditeur ou à un chapitre général, sans citation paginée, hash, statut de droits ou trace de la rédaction. Il ne doit pas être considéré comme un corpus historique vérifié.

Pour Bible Strong, STEPBible couvre déjà les Bibles, Strong, langues originales et morphologie avec une chaîne mieux maîtrisée. BibleMate n’apporte donc aucun corpus qu’il serait rationnel de réimporter. Les commentaires anciens éventuellement intéressants doivent être acquis depuis leurs sources primaires, édition par édition.

### Sécurité : architecture incompatible avec un service full online

Le risque le plus important est l’autorité accordée à l’agent :

- la [configuration Claude Code](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.claude/settings.json) autorise tous les scripts Python sous `.claude/skills`, `python3 -c:*`, ainsi que `git add`, `commit` et `push`, sans règle `deny` ;
- la [web app](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/web_app.py#L729-L779) transmet le message utilisateur à un agent doté de `policy.allow_all()` ; aucune authentification applicative n’est visible ;
- le [workflow final](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/biblemate/SKILL.md#L187-L193) prévoit un sync Git ; l’implémentation [stage tout le workspace, commit puis push](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/biblemate/biblemate_orchestrator.py#L1014-L1044) ;
- les fonctions de sauvegarde de l’orchestrateur acceptent un chemin de dossier existant sans vérifier qu’il reste sous `biblemate/`, ce qui agrandit encore l’impact d’une injection de prompt ;
- l’[updater](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/update/updater.py) télécharge et extrait le dernier ZIP de la branche principale sans version, signature ni checksum épinglé ;
- aucune défense systématique contre l’injection indirecte, aucun filtrage de sortie, quota, rate limiting distribué, isolation par utilisateur ou politique de confidentialité du service n’est fourni.

Ces choix peuvent être tolérables dans un workspace personnel local et conscient de ses permissions ; ils sont inacceptables pour une API mobile multi-utilisateur. Bible Strong doit exposer uniquement des outils métier read-only, à paramètres bornés et schémas stricts. Le modèle ne doit recevoir ni shell, ni écriture de fichiers, ni Git, ni SQL générique, ni accès réseau libre.

Les prompts et personas sont publics, comme ils le seront toujours en pratique après observation des réponses. Il ne faut donc pas chercher à empêcher le « reverse engineering » par le secret du prompt : la sécurité doit venir de l’absence de secrets dans le contexte, des autorisations côté serveur, de la validation des appels et des sorties, et de limites impossibles à contourner par instruction.

### Tests et maturité réelle

Le dépôt a été créé le 18 juin 2026 ; au moment de l’audit, son dernier commit date du 14 juillet 2026. GitHub attribue 143 contributions à un seul contributeur ; aucune release publiée, aucune CI et aucun manifest de dépendances verrouillé n’ont été trouvés. Les instructions installent plusieurs paquets avec `latest` ou `--upgrade`, ce qui nuit à la reproductibilité.

Deux fichiers de tests seulement ont été trouvés. Les 11 tests du retriever de témoignages ont réussi localement ; ils vérifient surtout présence des artefacts, recherche par mots et structure Markdown. Le test de suppression de la web app n’a pas pu être lancé dans l’environnement d’audit faute de dépendance `nicegui`, ce qui confirme au minimum l’absence d’installation reproductible depuis un manifest local.

Le « quality score » de l’[orchestrateur](https://github.com/eliranwong/biblemate-agentic-workspace/blob/b699299e55ad6ce842ac392ddb635dd34efbaac8/.agents/skills/biblemate/biblemate_orchestrator.py#L753-L841) mesure principalement nombre de skills, octets produits, nombre de motifs ressemblant à des références bibliques et présence de fichiers finaux. Il ne vérifie ni vérité, ni support par une source, ni exactitude d’une citation, ni neutralité, ni sécurité. Les cycles où le même modèle rédige, audite et révise peuvent améliorer la forme ; ils ne fournissent pas une évaluation indépendante. L’affirmation du README selon laquelle les hallucinations de citations bibliques sont « complètement éliminées » est donc trop large.

### Décision détaillée

| Élément | Décision | Adaptation pour Bible Strong |
|---|---|---|
| Lookup déterministe avant citation | **Réutiliser le principe** | Fonctions Postgres read-only et validation serveur des références/sourceIds |
| Workflow plan → retrieval → analyse → synthèse → audit | **Référencer** | Réserver à un mode « étude approfondie » asynchrone, avec budgets et étapes persistées |
| Artefacts intermédiaires et reprise | **Référencer** | Stocker un état structuré par job, pas des fichiers arbitraires dans un workspace Git |
| Personas multiples | **Éviter comme garantie de pluralité** | Utiliser des rôles de pipeline ; la diversité doit venir de sources/traditions et d’évaluateurs distincts |
| 125 skills et boucles imposées | **Éviter pour le chat courant** | Petit registre d’outils métier, sélection déterministe et limites strictes de tours/coût |
| Code du dépôt | **Ne pas réutiliser actuellement** | Aucune licence explicite et architecture locale spécifique à trois plateformes IDE |
| `biblematedata` et corpus | **Éviter** | Import direct de chaque source approuvée avec manifeste de droits et hashes |
| Permissions, Git sync et web app | **Éviter absolument** | Aucun shell/Git/écriture ; auth, quotas, isolation, modération et observabilité côté backend |
| Quality score et auto-audit | **Ne pas traiter comme une eval** | Benchmark de retrieval, citation entailment, exactitude, pluralité, refus et injections |

**Verdict :** BibleMate mérite une place comme **référence de workflow agentique pour les études longues**, après simplification radicale. Il n’est ni un fournisseur de données fiable, ni un RAG sourcé, ni une base de code ou de sécurité adaptée au full online. Son meilleur apport à Bible Strong est de montrer la valeur d’une séparation retrieval/analyse/synthèse et d’artefacts reprenables ; son principal contre-exemple est de confier shell, fichiers et Git à l’agent tout en assimilant volume et auto-révision à de la qualité.

## 6. context-grounded-bible et mybibletoolbox-data : un générateur et son dépôt de données, pas un RAG

### Relation exacte entre les dépôts

[`context-grounded-bible`](https://github.com/authenticwalk/context-grounded-bible/tree/62a809dd357a59913702767898dc1d5aae2454a9) est le monorepo original, créé en octobre 2025. Il mêle instructions pour Claude Code, scripts de génération, schémas YAML et données. Le [commit de scission du 30 octobre 2025](https://github.com/authenticwalk/mybibletoolbox-code/commit/4536d85c51d8186787d5bae7bfb8d034952f8e20) explique explicitement son remplacement par deux dépôts : `mybibletoolbox-code` pour les outils et `mybibletoolbox-data` pour le contenu du dossier `bible/`. Le dépôt [`mybibletoolbox-data`](https://github.com/authenticwalk/mybibletoolbox-data/tree/8fb72a3b204615bd1678d24adf58ddd9cfbb221d) n’est donc pas un corpus indépendant : c’est le successeur « données » de l’ancien monorepo.

`context-grounded-bible` n’a plus reçu de commit après cette scission et doit être lu comme un prédécesseur historique, même s’il n’est pas marqué archivé. Au 21 août 2026, aucun des deux dépôts n’a de release ; le dépôt de données reste un projet jeune, maintenu essentiellement comme un gros export versionné.

### Architecture et retrieval réels

Il n’y a dans les deux dépôts nommés ni embeddings, ni index vectoriel, ni recherche hybride, ni reranking, ni expansion de requête, ni API de chat, ni serveur MCP opérationnel. Le [README original](https://github.com/authenticwalk/context-grounded-bible/blob/62a809dd357a59913702767898dc1d5aae2454a9/README.md) range encore MCP et sous-agent parmi les évolutions futures. Sa méthode de consommation consiste essentiellement à concaténer les YAML d’un verset avant de les donner au modèle.

L’unité de découpage est déterministe : **un verset × un type de source × un fichier YAML**. C’est une convention lisible et utile pour éviter les fichiers monolithiques, mais ce n’est pas une stratégie RAG. Aucun score ne sélectionne les passages pertinents et aucune diversification ne borne l’influence d’une source. Certaines entrées eBible par verset dépassent 500 Ko ; concaténer « tout le contexte » augmenterait fortement coût et bruit. Bible Strong devrait au contraire filtrer par type de source, traduction, licence et budget, puis appliquer FTS/embeddings et reranking uniquement aux contenus textuels qui justifient une recherche sémantique.

Le seul index directement exploitable est [`verse-strongs.sqlite`](https://github.com/authenticwalk/mybibletoolbox-data/blob/8fb72a3b204615bd1678d24adf58ddd9cfbb221d/databases/verse-strongs.sqlite) : une table de 29 749 références contenant une liste d’identifiants Strong, la langue et un nombre de mots. C’est un lookup exact, non un moteur de recherche. Bible Strong possède déjà l’équivalent et davantage via STEPBible dans Postgres.

### Corpus réellement présent et écart avec les promesses

Le README du dépôt de données annonce le « plus grand commentaire biblique lisible par IA », du contexte historique et culturel ainsi que plusieurs traditions théologiques. L’arbre vérifié au commit `8fb72a3` contient en réalité surtout :

- 29 749 fichiers Macula de données linguistiques structurées ;
- 11 649 fichiers TBTA de clauses et traits de traduction ;
- 30 740 fichiers regroupant les traductions eBible d’un verset ;
- des entrées Strong, occurrences, références et 12 115 définitions UBS ;
- 471 fichiers `llm-baseline-opus45`, explicitement destinés à un test de baseline et marqués `not_for_production`.

Les ressources historiques, culturelles, théologiques et les références croisées promises ne forment pas un corpus substantiel dans l’export actuel. Dans le [registre d’outils de l’ancien dépôt](https://github.com/authenticwalk/context-grounded-bible/blob/62a809dd357a59913702767898dc1d5aae2454a9/bible-study-tools/tool-registry.yaml), plusieurs de ces catégories sont d’ailleurs commentées comme outils futurs. La langue n’est pas le problème : Bible Strong peut rechercher en anglais et rédiger en français. En revanche, importer des centaines de traductions ne crée pas une base historique factuelle et ajoute volume, bruit et obligations de licence.

Les formats donnent quelques idées utiles : référence USFM canonique, séparation par source, métadonnée `source`, distinction explicite des sorties LLM. Un [fichier Macula](https://github.com/authenticwalk/mybibletoolbox-data/blob/8fb72a3b204615bd1678d24adf58ddd9cfbb221d/commentary/JHN/001/001/JHN-001-001-macula.yaml) expose mots, lemmes, morphologie, Strong, domaine sémantique et syntaxe ; un [fichier TBTA](https://github.com/authenticwalk/mybibletoolbox-data/blob/8fb72a3b204615bd1678d24adf58ddd9cfbb221d/commentary/JHN/001/001/JHN-001-001-tbta.yaml) structure clauses et traits. Ces données recouvrent largement ce que Bible Strong possède déjà. Si un champ complémentaire s’avère utile, il faut l’acquérir depuis Macula ou TBTA directement, avec version et licence épinglées.

### Provenance, citations et licences : chaîne insuffisante

L’ancien dépôt possède une [licence MIT](https://github.com/authenticwalk/context-grounded-bible/blob/62a809dd357a59913702767898dc1d5aae2454a9/LICENSE), qui ne re-licencie pas les œuvres tierces. Le dépôt de données actuel n’a pas de fichier `LICENSE` et GitHub ne lui détecte aucune licence ; la simple mention « MIT » de son [README](https://github.com/authenticwalk/mybibletoolbox-data/blob/8fb72a3b204615bd1678d24adf58ddd9cfbb221d/README.md) n’établit pas les droits sur chaque traduction, lexique ou annotation.

La [page d’attribution historique](https://github.com/authenticwalk/context-grounded-bible/blob/62a809dd357a59913702767898dc1d5aae2454a9/ATTRIBUTION.md) reconnaît que les licences eBible varient, mais l’[export eBible final](https://github.com/authenticwalk/mybibletoolbox-data/blob/8fb72a3b204615bd1678d24adf58ddd9cfbb221d/commentary/JHN/001/001/JHN-001-001-translations-ebible.yaml) conserve seulement des codes et textes : il ne transporte ni titre/édition, ni licence, ni attribution, ni URL ou commit amont par traduction. Il devient donc impossible d’appliquer correctement les obligations ressource par ressource. Les affirmations générales de « fair use » pour NIV, ESV, NASB ou Message, ou de « libre accès pour la recherche » pour des sites de commentaires, ne constituent pas un droit général de scraper, embarquer, créer des embeddings et redistribuer ces contenus.

Quelques fichiers sont mieux documentés : une [définition UBS](https://github.com/authenticwalk/mybibletoolbox-data/blob/8fb72a3b204615bd1678d24adf58ddd9cfbb221d/strongs/G0026/G0026-ubs-definition.yaml) indique CC BY-SA 4.0. Cela impose justement de traiter cette ressource séparément, avec attribution et analyse du partage à l’identique, plutôt que sous une bannière MIT globale. Le [schéma de citations](https://github.com/authenticwalk/context-grounded-bible/blob/62a809dd357a59913702767898dc1d5aae2454a9/SCHEMA.md) propose des marqueurs textuels comme `{source-id}`, mais sans identifiant d’artefact épinglé, édition, localisateur précis ni vérification serveur que l’extrait soutient l’affirmation. Ce sont des étiquettes, pas des citations probantes.

### Défauts d’intégrité mesurables

Le problème n’est pas seulement juridique ou documentaire. Dans l’arbre Strong du commit audité, **1 984 fichiers portent dans leur nom un numéro Strong différent du dossier qui les contient**. Plus grave, [`strongs/G0032/G0026-strongs.strongs.yaml`](https://github.com/authenticwalk/mybibletoolbox-data/blob/8fb72a3b204615bd1678d24adf58ddd9cfbb221d/strongs/G0032/G0026-strongs.strongs.yaml) concatène une entrée G0032 puis une entrée G0026 avec des clés YAML racine répétées ; selon le parseur, une partie peut écraser l’autre. L’arbre contient aussi plusieurs noms d’occurrences manifestement concaténés.

Ces corruptions prouvent que la génération en masse n’a pas été contrôlée par des invariants élémentaires `dossier == identifiant == contenu`. Elles interdisent d’utiliser ce dépôt comme source canonique, même avant l’examen théologique. Les 471 baselines LLM ne doivent pas non plus être indexées : leur [`_meta` les marque explicitement hors production](https://github.com/authenticwalk/mybibletoolbox-data/blob/8fb72a3b204615bd1678d24adf58ddd9cfbb221d/strongs/G0032/G0032-llm-baseline-opus45.strongs.yaml), tandis que leur prose contient déjà des conclusions confessionnelles présentées avec assurance.

### Tests, évaluations et sécurité

Le générateur original se décrit comme une [« Phase 1 MVP »](https://github.com/authenticwalk/context-grounded-bible/blob/62a809dd357a59913702767898dc1d5aae2454a9/agents/bible-tool-creator/README.md) et produit d’abord du YAML placeholder, sans véritable intégration LLM ou recherche documentaire. Son [validateur](https://github.com/authenticwalk/context-grounded-bible/blob/62a809dd357a59913702767898dc1d5aae2454a9/agents/bible-tool-creator/lib/validator.py) vérifie surtout syntaxe YAML, format de référence, taille de fichier et présence d’un motif `{source-id}`. Il ne vérifie ni existence de la source, ni support de l’affirmation, ni licence, ni correspondance identifiant/chemin, ni doublons. Les ambitieuses [consignes de revue](https://github.com/authenticwalk/context-grounded-bible/blob/62a809dd357a59913702767898dc1d5aae2454a9/REVIEW-GUIDELINES.md) restent manuelles et ne compensent pas ces lacunes.

Il n’existe aucun benchmark de retrieval, fidélité aux citations, exactitude historique, pluralité théologique, traduction française ou résistance aux injections. Comme les dépôts nommés n’exposent pas de service en ligne, ils n’apportent non plus aucun modèle d’authentification, isolation, quota, confidentialité ou modération. Les YAML et toute future page récupérée doivent être traités comme contenu non fiable : ils ne doivent jamais modifier les règles système ou l’autorité des outils.

### Décision détaillée

| Élément | Décision | Adaptation pour Bible Strong |
|---|---|---|
| Convention `USFM/chapitre/verset/source.yaml` | **Référencer** | Conserver des `sourceId` et types de source, mais pas nécessairement un fichier physique par verset |
| Lookup verset → Strong | **Ne pas reprendre** | Déjà couvert avec davantage de garanties par STEPBible/Postgres |
| Macula, TBTA, eBible, UBS | **Évaluer à la source primaire seulement** | Version/commit, licence et métadonnées par artefact ; importer uniquement les champs complémentaires |
| Traductions eBible agrégées | **Éviter** | Liste blanche par traduction ; conserver son manifeste de droits complet |
| Baselines LLM et prose générée | **Éviter absolument** | Jeux de test séparés, jamais mélangés au corpus de production |
| Code et données de ces dépôts | **Ne pas forker/importer** | Aucun moteur RAG ; licence du dépôt de données absente et intégrité insuffisante |
| Idée d’agents générateurs | **Référencer avec prudence** | Pipeline d’ingestion isolé, sources allowlistées, schémas stricts et revue humaine avant publication |

**Verdict :** référencer uniquement les conventions de structuration et l’idée de séparer les sources. Ne pas forker `context-grounded-bible`, ne pas ingérer `mybibletoolbox-data` et ne pas le considérer comme un commentaire historique. Pour chaque donnée réellement utile, repartir du dépôt amont, figer l’artefact et sa licence, valider l’intégrité, puis l’indexer dans le RAG sourcé de Bible Strong. Le fait de pouvoir traduire la réponse finale en français rend inutile l’accumulation de traductions intermédiaires non maîtrisées.

## 7. Les autres projets

### Scripture Recall

Le modèle choisit les références, puis l’application récupère les versets exacts depuis sa propre base. C’est un garde-fou supérieur à la demande « cite correctement » dans un prompt. Bible Strong devrait généraliser ce principe : le LLM renvoie des `sourceIds`, et le backend rend les textes/citations canoniques. Le dépôt lui-même n’est pas réutilisable : aucune licence trouvée, clé OpenAI utilisée côté client et maintenance de hackathon.

### BibleNLP / Awesome Bible NLP

Le catalogue pointe vers eBible, Biblical Humanities, Macula, OPUS et différents alignements. Il est utile pour découvrir de futurs jeux multilingues ou préparer des tests cross-lingues. Sa licence MIT couvre la liste, pas automatiquement chaque ressource référencée.

### BibleTopics

Le graphe thème → versets dérive des votes et scores OpenBible.info. Les thèmes sont nombreux, parfois dupliqués, bruités ou sensibles. Il pourrait servir comme faible signal de rappel ou de boosting, jamais comme vérité ni comme réponse. Aucune licence n’a été trouvée dans le dépôt : préférer le Nave déjà présent dans Bible Strong, ou obtenir une autorisation explicite avant ingestion.

### bible-ai-assistant

Le dépôt documente de bons modes d’échec — référence inventée, fuite de prompt, répétition, remplissage verbeux, réponse biblique forcée à toute question — et quelques protections d’API. Mais ses propres résultats rendent son modèle local impropre à la production : précision des versets de 9,3 % pour la variante F16, taux d’hallucination de 26 %, et résultats encore inférieurs pour Q4. Le model card annonce parallèlement des chiffres plus favorables, le document d’évaluation détaillé est vide, un JSON annoncé manque, et une exécution du juge versionnée a obtenu uniquement des zéros à cause d’un endpoint en erreur 404. Cela confirme qu’un fine-tuning local n’est pas une priorité pour Bible Strong.

## Licence du code ≠ licence des données

Le principal risque récurrent est la confusion entre quatre objets juridiques distincts :

1. le code du serveur RAG ;
2. le texte de l’œuvre sous-jacente ;
3. l’édition, traduction ou transcription précise ;
4. les embeddings, résumés, annotations et autres dérivés.

Une licence MIT sur le code ne prouve rien pour les trois autres. Chaque unité ingérée devrait avoir au minimum : `source_id`, auteur, titre, type de source, tradition/position, langue, édition, URL primaire, date d’acquisition, hash, licence exacte, attribution, droits de modification/redistribution, territoire, statut de revue et granularité de citation.

## La langue du corpus n’est pas un obstacle, mais doit être évaluée

Il n’est pas nécessaire de traduire préalablement tout le corpus en français. Une chaîne raisonnable est :

1. conserver le texte original et ses métadonnées ;
2. générer une ou plusieurs requêtes dans la langue du corpus ;
3. combiner recherche lexicale dans cette langue et embeddings multilingues ;
4. rédiger la réponse en français ;
5. afficher la citation originale et, si utile, une traduction clairement marquée « traduction IA ».

Il faut néanmoins comparer trois stratégies sur le même benchmark français : embedding direct de la question française, traduction FR → langue source avant recherche, et fusion des deux résultats par RRF. Une traduction de requête peut améliorer la recherche exacte tout en introduisant des glissements sémantiques ; cela se mesure, cela ne se suppose pas.

## Architecture concrète recommandée pour Bible Strong

```text
Question ou contexte de lecture
        │
        ▼
Routeur d’intention à sorties structurées
        │
        ├── outils déterministes : Bible, Strong, dictionnaires, tags
        ├── recherche corpus approuvé : FTS + embeddings + filtres
        └── refus / orientation : hors périmètre, crise, conseil sensible
        │
        ▼
Reranking + diversification par œuvre/tradition/type
        │
        ▼
Génération à partir des seuls extraits autorisés
        │
        ▼
Validation serveur des sourceIds, références et affirmations à risque
        │
        ▼
Rendu français avec citations exactes, provenance, confiance et désaccords
```

Règles de départ :

- aucun fait historique ou lexical ne doit être attribué à une « connaissance générale du modèle » dans un mode sourcé ;
- si la recherche ne fournit pas de preuve suffisante, répondre « sources insuffisantes » au lieu de compléter de mémoire ;
- séparer dans les données `factuel`, `interprétation`, `tradition`, `controverse` et `confiance éditoriale` ;
- rendre les versets, Strong et citations exactes depuis Postgres, jamais depuis la prose du modèle ;
- limiter le nombre d’outils, résultats, tokens, tours et requêtes externes ;
- ne jamais exposer de connexion SQL ou un outil générique au modèle : uniquement des fonctions métier avec paramètres allowlistés ;
- conserver les prompts, clés fournisseur et politiques uniquement côté serveur ;
- journaliser identifiants de sources, latence, coûts et verdicts, pas le contenu utilisateur par défaut ;
- filtrer les instructions présentes dans les documents récupérés comme données non fiables ;
- évaluer séparément retrieval, fidélité des citations, exactitude biblique, pluralité théologique, refus, injection de prompt et traduction.

## Plan de réutilisation proposé

1. **Maintenant :** copier comme concepts le schéma de provenance de TheologAI, le format de benchmark de bible-rag, les niveaux de confiance de Claude of Alexandria et l’insertion déterministe de Scripture Recall.
2. **POC :** 100 à 300 documents soigneusement licenciés, avec recherche hybride et réponse française, sans expansion LLM automatique.
3. **Benchmark :** 150 à 300 questions françaises couvrant recherche exacte, thèmes, histoire, lexique, controverses, refus et attaques ; vérité terrain constituée d’identifiants de sources.
4. **Corpus :** importer depuis les détenteurs ou dépôts primaires seulement ; lancer un contrôle de droits et une revue éditoriale avant indexation.
5. **Production :** ajouter validation des citations, budgets, rate limiting distribué, modération, observabilité respectueuse de la vie privée, versionnement du corpus et rollback.

La bonne unité de réutilisation n’est donc pas un « bot Bible » entier : ce sont des **contrats de sources, tests, outils métier et garde-fous vérifiables** assemblés autour des données déjà maîtrisées par Bible Strong.

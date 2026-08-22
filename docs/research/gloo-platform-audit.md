# Audit de la plateforme Gloo AI pour Bible Strong

**Date de recherche :** 21 août 2026

**Périmètre :** documentation, API, tarification et textes juridiques publics de Gloo uniquement

**Décision visée :** définir un MVP **Gloo-first** qui délègue le RAG, les modèles et les garde-fous à Gloo, tout en conservant uniquement les données bibliques exactes et une façade minimale chez Bible Strong

## Révision Gloo-first

Pour le MVP, la recommandation est désormais : **aucun RAG Bible Strong**, `GlooGrounded` comme corpus par défaut, et `POST /ai/v2/chat/completions/grounded` comme route principale avec `auto_routing: true`, `include_citations: true` et une `tradition` explicite lorsqu’elle est choisie par le produit ou l’utilisateur. Bible Strong ne garde que les tools exacts `get_passage`, `get_strong_entry` et `get_entity`, une façade serveur minimale, le contrôle de `sources_returned`/citations et un fallback léger vers les fonctions bibliques déterministes en cas d’absence de source ou d’indisponibilité. ([Grounded Completions](https://docs.gloo.com/api-guides/grounded-completions), [Tool Use](https://docs.gloo.com/api-guides/tool-use), [guide de fiabilité Gloo](https://docs.gloo.com/best-practices/trustworthy-grounded-applications))

Un Publisher Data Engine Bible Strong ne sera ajouté que si les tests révèlent des lacunes de couverture, de français ou de qualité. Cette simplicité a deux réserves : Gloo décrit `GlooGrounded` uniquement comme un dataset partagé assemblé par Gloo, sans inventaire public de ses sources ou licences ; et Gloo recommande de spécifier son propre Publisher pour maîtriser le contenu qui fonde les réponses. `GlooGrounded` convient donc au MVP Gloo-first sous réserve des droits d’usage, tandis qu’un Publisher propre est le chemin de repli pour garantir provenance et contenu. ([Grounded Completions — RAG configuration](https://docs.gloo.com/api-guides/grounded-completions#rag-configuration), [Grounded Responses — request format](https://docs.gloo.com/api-guides/grounded-responses#request-format), [Data Engine](https://docs.gloo.com/api-guides/content))

## Verdict

**Sous l’hypothèse Gloo-first demandée, un MVP d’outil d’étude est réaliste sans RAG Bible Strong.** Le chemin principal doit être Grounded Completions, avec `GlooGrounded` pour la découverte générale et un Publisher Data Engine Bible Strong pour les ressources non exactes que Bible Strong a le droit d’ingérer. Bible Strong conserve seulement les passages, entités et entrées Strong exacts, une façade Cloudflare, et les contrôles minimums que Gloo attribue explicitement à l’application.

Cette recommandation est **conditionnelle** : la documentation publique ne décrit `GlooGrounded` que comme « un dataset partagé assemblé par Gloo ». Elle n’en publie ni l’inventaire, ni les versions, ni les licences source par source, ni les droits d’affichage dans une application B2C. `GlooGrounded` peut donc être le moteur technique du POC, mais pas le corpus d’un lancement public tant que l’Order Gloo n’accorde pas ces droits par écrit. ([Grounded Completions](https://docs.gloo.com/api-guides/grounded-completions), [Gloo Services Terms](https://gloo.com/legal/entity-termsofservice), [Acceptable Use Policy](https://gloo.com/legal/acceptable-use-policy))

L’architecture cible devient :

```text
Application Bible Strong
  -> façade Cloudflare minimale
    -> route exacte : passages, entités, Strong dans Neon/Postgres
    -> route étude : Grounded Completions Gloo
      -> GlooGrounded OU Publisher Bible Strong dans le Data Engine
      -> auto-routing, tradition, citations, tools
    -> contrôle minimal : sources_returned, citations, erreurs, contenu sensible
```

Ce choix achète effectivement le retrieval, l’ingestion, les embeddings, le routage multi-modèles, les garde-fous et les perspectives chrétiennes. Il ne permet pas de supprimer la façade : Gloo précise que **la vérification des affirmations, citations et cas sans source relève de l’application**. Les conditions AI Studio précisent en outre que les sorties ne doivent pas être considérées comme une source factuelle sans validation. ([guide de fiabilité Gloo](https://docs.gloo.com/best-practices/trustworthy-grounded-applications), [conditions AI Studio](https://gloo.com/legal/ai-studio-supplemental-terms-of-service))

**Recommandation actionnable :** construire directement le POC Gloo-first, sans pgvector, BM25, RRF ni reranker côté Bible Strong. Tester `GlooGrounded` en environnement interne, charger dans un Publisher séparé uniquement des ressources aux droits maîtrisés, et n’ouvrir au public qu’après autorisation B2C, provenance/licensing, DPA et critères qualité. Une architecture RAG Bible Strong ne redevient nécessaire que si Gloo échoue aux tests de rappel, français, citations ou droits.

## 0. Mise en œuvre Gloo-first

### 0.1 Ce que `GlooGrounded` contient — et ce qui n’est pas promis

| Question | Réponse officielle vérifiable | Conséquence MVP |
| --- | --- | --- |
| Qu’est-ce que c’est ? | Un « shared dataset assembled by Gloo » | C’est la seule description publique suffisamment précise trouvée |
| Comment le sélectionner ? | Omettre `rag_publisher` le sélectionne par défaut ; la valeur vide désactive le retrieval sur Grounded Responses | La façade devrait envoyer explicitement `rag_publisher: "GlooGrounded"` pour rendre le choix visible dans la configuration et les logs |
| Que contient-il ? | Non documenté publiquement : aucun inventaire des Bibles, commentaires, éditeurs, langues ou traditions | Ne promettre aucune couverture particulière dans l’interface |
| Quelle provenance ? | Les citations peuvent fournir titre, URL, auteur, publisher, date et snippets pour les sources effectivement récupérées | Cela renseigne une réponse, pas la composition complète ni la version du dataset |
| Quelles licences ? | Non publiées source par source ; les conditions qualifient le contenu Gloo de contenu détenu ou licencié par Gloo/tiers et donnent seulement un droit d’usage limité | Exiger une annexe de droits couvrant recherche, génération, extraits, traduction française, cache et affichage B2C |
| Gloo le recommande-t-il ? | Il est le fallback par défaut, mais Gloo recommande « for best results » de toujours spécifier son propre Publisher | Utiliser `GlooGrounded` pour découverte/benchmark et le Data Engine propre pour les ressources dont Bible Strong doit garantir la provenance |

Sources : [Grounded Completions — RAG configuration](https://docs.gloo.com/api-guides/grounded-completions#rag-configuration), [Grounded Responses — request format](https://docs.gloo.com/api-guides/grounded-responses#request-format), [Gloo Services Terms, sections 5–6](https://gloo.com/legal/entity-termsofservice), [AI Studio Supplemental Terms](https://gloo.com/legal/ai-studio-supplemental-terms-of-service).

**Conclusion factuelle :** aucune source Gloo publique actuelle ne permet d’affirmer que `GlooGrounded` contient telle Bible, tel commentaire ou des ressources françaises. Aucune source officielle ne relie non plus explicitement `GlooGrounded` au catalogue « Affiliate Recommendations ». Il faut demander un inventaire et des droits, sans déduire l’un de l’autre.

### 0.2 Choisir la bonne surface Gloo

Pour le MVP demandé, **Grounded Completions** (`POST /ai/v2/chat/completions/grounded`) est le seul chemin documenté qui réunit dans un même appel : RAG, `tradition`, citations, auto-routing et tools. Grounded Responses offre le format Responses et un seuil de certitude, mais reste en v1 et ne fournit ni `tradition` ni métadonnées de citations. Responses v2 est la route générale recommandée par Gloo, mais n’effectue pas le RAG. ([Grounded Completions](https://docs.gloo.com/api-guides/grounded-completions), [Grounded Responses — comparison](https://docs.gloo.com/api-guides/grounded-responses#grounded-responses-vs-grounded-completions), [Responses](https://docs.gloo.com/api-guides/responses))

La route grounded est distincte de `/chat/completions` et n’est pas atteinte par l’appel standard du SDK OpenAI ; Gloo recommande une requête HTTP directe. Un appel minimal ressemble à ceci :

```json
{
  "messages": [
    {
      "role": "system",
      "content": "Réponds en français. Distingue les faits sourcés des interprétations. N'invente ni citation ni référence."
    },
    {
      "role": "user",
      "content": "Que peut-on apprendre du contexte historique de Philippiens 2 ?"
    }
  ],
  "auto_routing": true,
  "rag_publisher": "GlooGrounded",
  "sources_limit": 5,
  "tradition": "evangelical",
  "include_citations": true,
  "parallel_tool_calls": false,
  "stream": false
}
```

Règles de configuration :

- exactement un mécanisme de modèle : `auto_routing`, `model_family` ou `model` ; Gloo présente `auto_routing` comme le choix recommandé général ;
- `tradition` vaut `evangelical`, `catholic`, `mainline`, `not_faith_specific`, ou est omis pour une perspective chrétienne générale ; Bible Strong doit valider cette valeur localement et ne l’envoyer que si le produit ou l’utilisateur l’a choisie ;
- `include_citations` doit être explicitement `true`, car sa valeur par défaut est `false` ;
- `sources_limit` accepte 1 à 10 ; commencer à 5 laisse une seule escalade possible vers 10 ;
- `stream: false` est préférable au MVP : Gloo recommande de mettre en mémoire tampon et vérifier les réponses factuelles ou doctrinales avant affichage ;
- la réponse doit enregistrer le modèle et le mécanisme réellement utilisés, ainsi que `sources_returned` et les citations.

Sources : [Completions V2 — routing](https://docs.gloo.com/api-guides/completions-v2#routing-mechanisms), [Grounded Completions — parameters](https://docs.gloo.com/api-guides/grounded-completions#request-parameters), [Building Trustworthy Grounded Applications](https://docs.gloo.com/best-practices/trustworthy-grounded-applications#verify-before-you-stream).

### 0.3 Utiliser les tools uniquement pour l’exact

Grounded Completions accepte `tools`, `tool_choice` et `parallel_tool_calls`. Le bon découpage Gloo-first est :

- Gloo/Data Engine répond aux questions ouvertes, historiques, thématiques et de synthèse ;
- `get_passage`, `get_entity` et `get_strong_entry` renvoient les données canoniques Bible Strong ;
- sur un écran déjà contextualisé, la façade fournit directement l’identifiant exact au lieu de demander au modèle de le deviner ;
- dans le chat libre, le modèle peut demander un tool, mais Cloudflare valide les arguments, exécute une requête prédéfinie en lecture seule, puis renvoie le résultat à Gloo ;
- aucun tool SQL, aucune URL arbitraire et aucune écriture ne sont exposés.

Gloo utilise le schéma de fonction imbriqué Chat Completions sur ses surfaces ; il avertit que le schéma plat Responses n’est pas accepté de façon fiable chez tous les fournisseurs. L’application reste responsable de l’exécution. ([Tool Use](https://docs.gloo.com/api-guides/tool-use), [Grounded Completions — request parameters](https://docs.gloo.com/api-guides/grounded-completions#request-parameters))

### 0.4 Router `GlooGrounded` et le Data Engine

`rag_publisher` est une chaîne unique. Les API publiques ne documentent pas une requête fédérée sur `GlooGrounded` **et** un Publisher privé dans le même appel. La façade doit donc choisir explicitement :

| Intention | `rag_publisher` | Traitement |
| --- | --- | --- |
| Passage, personne, lieu ou Strong exact | Aucun appel RAG si une réponse déterministe suffit | Neon/Postgres exact |
| Question générale de découverte biblique | `GlooGrounded` | Autorisé en POC ; public seulement avec droits écrits |
| Question liée aux ressources éditoriales Bible Strong | Publisher Data Engine Bible Strong | Contenu préalablement autorisé et métadonné |
| Question mixte | Un Publisher principal + tools exacts | Ne pas fusionner silencieusement deux corpus ; lancer éventuellement un second appel clairement séparé |

Cette contrainte n’impose pas un RAG Bible Strong. Le Data Engine prend en charge parsing, chunking, embedding et indexation. Bible Strong garde seulement les originaux et droits permettant de reconstruire le Publisher ; le chunking Gloo ne peut être ni désactivé ni réglé, donc les unités à frontière dure doivent être envoyées comme éléments distincts. ([Content](https://docs.gloo.com/api-guides/content), [How Chunking Works](https://docs.gloo.com/api-guides/chunking), [Manage Publishers](https://docs.gloo.com/studio/manage-publishers))

### 0.5 Fallbacks à implémenter

| Situation | Comportement Gloo documenté | Politique minimale Bible Strong |
| --- | --- | --- |
| `sources_returned: false` | La génération continue et peut produire une réponse fluide non sourcée | Augmenter `sources_limit` une fois de 5 à 10 ; si aucune source ne revient, afficher la réponse avec le label explicite « réponse générale de l’IA, sans source Gloo » |
| Citation ou titre renvoyé | Gloo fournit les métadonnées et snippets, sans garantir le support de chaque phrase | Afficher les cartes sources Gloo telles quelles ; éviter les longues citations verbatim et ne pas construire de vérificateur sémantique au MVP |
| `429 SPENDING_LIMIT_EXCEEDED`, `retryable: false` | Réessayer ne sert à rien | Basculer en mode exact sans IA, afficher une indisponibilité temporaire et alerter |
| `429` de quota avec `Retry-After` | Peut être transitoire | Respecter l’en-tête ; backoff exponentiel avec jitter, budget borné |
| `408`, `5xx` ou erreur provider `retryable: true` | Candidat à retry borné | Deux retries maximum en UX live avant tout affichage ; conserver le `trace_id` |
| Retrait ou panne de modèle | Auto-routing et le gateway apportent du failover ; les retraits restent best effort | Utiliser `auto_routing` au MVP ; si l’erreur persiste, mode exact sans IA, pas de réponse paramétrique non sourcée |
| `finish_reason: content_filter` | Terminal, sans retry | Afficher un refus sobre ; ne pas reformuler automatiquement pour contourner le filtre |
| Hard block `403` | Requête rejetée par les garde-fous | Terminal ; ne pas retry à l’identique |
| Réponse statique de garde-fou | Peut revenir comme une réponse normale | L’afficher comme réponse de sécurité ; aucune logique fiable de détection n’est documentée |
| Stream interrompu après texte visible | Une continuation est une nouvelle génération qui peut dériver | Évité au MVP avec `stream: false`; plus tard, ne jamais auto-continuer un contenu doctrinal |
| Tool déjà exécuté puis erreur | Un retry peut dupliquer l’effet | Tools en lecture seule et idempotents ; ne pas rejouer automatiquement un tool à effet |

Sources : [Grounded Responses — no sources](https://docs.gloo.com/api-guides/grounded-responses#when-no-sources-are-found), [Building Trustworthy Grounded Applications](https://docs.gloo.com/best-practices/trustworthy-grounded-applications), [Rate Limits](https://docs.gloo.com/api-reference/general/limits), [Errors](https://docs.gloo.com/api-reference/general/errors), [Handling Streaming Failures](https://docs.gloo.com/best-practices/completions-streaming-failures), [Model Lifecycle](https://docs.gloo.com/api-guides/model-lifecycle), [Responses — guardrails](https://docs.gloo.com/api-guides/responses#guardrails-and-values).

### 0.6 Contenu sensible : périmètre du MVP

Pour un **outil d’étude**, le MVP peut réduire fortement le risque en excluant les notes personnelles, prières privées, accompagnement pastoral et profils spirituels. Il peut s’appuyer sur les garde-fous d’entrée automatiques de Gloo au lieu de construire un classifieur Bible Strong. Un refus Gloo est affiché tel quel et un lien d’aide statique peut rester disponible dans l’interface. Cette limitation de périmètre reste utile car :

- les conditions Gloo rendent l’application responsable de ses garde-fous et de la supervision ;
- l’AUP interdit de transmettre certaines informations sensibles avec une liste non exhaustive ;
- la Privacy Statement inclut l’affiliation religieuse parmi les informations sensibles ;
- aucun protocole public Gloo complet n’a été trouvé pour les crises pastorales françaises ;
- un content filter est terminal et ne doit pas être contourné par retry.

Sources : [Acceptable Use Policy](https://gloo.com/legal/acceptable-use-policy), [Privacy Statement](https://gloo.com/legal/privacy-statement), [Gloo Services Terms](https://gloo.com/legal/entity-termsofservice), [Handling Streaming Failures](https://docs.gloo.com/best-practices/completions-streaming-failures#streaming-failure-phases).

### 0.7 Architecture minimale, sans RAG Bible Strong

```text
Mobile
  -> POST /ai/study { question, locale, tradition?, screenContext }
Cloudflare Worker
  1. authentifie, limite taille/débit et retire les identifiants inutiles
  2. minimise les données et laisse Gloo appliquer ses garde-fous d’entrée
  3. route les IDs exacts vers trois fonctions Neon en lecture seule
  4. choisit GlooGrounded ou le Publisher Bible Strong
  5. appelle Grounded Completions par HTTP direct, non streamé
  6. contrôle sources_returned et les citations, puis renvoie le résultat
Gloo
  -> Data Engine / GlooGrounded -> modèle routé -> garde-fous -> citations
```

Il n’y a dans ce schéma ni embeddings, ni index vectoriel, ni reranker, ni orchestration multi-modèles chez Bible Strong. La façade peut tenir dans un seul Worker et trois tools de lecture. L’état de conversation reste côté Bible Strong, car Gloo documente ses appels comme stateless et demande au client de gérer l’historique. ([Overview](https://docs.gloo.com/getting-started/overview), [Grounded Completions](https://docs.gloo.com/api-guides/grounded-completions), [Building Trustworthy Grounded Applications — shared responsibility](https://docs.gloo.com/best-practices/trustworthy-grounded-applications#shared-responsibility))

### 0.8 Indispensable ou facultatif pour le MVP

| Contrôle | MVP étude | Pourquoi |
| --- | --- | --- |
| Clé Gloo uniquement côté Cloudflare | **Indispensable** | Empêche extraction et appels hors quota |
| Autorisation écrite B2C et droits `GlooGrounded` | **Indispensable avant public** | Les textes publics ne suffisent pas pour l’affichage aux utilisateurs |
| `rag_publisher` explicite | **Indispensable** | Évite un changement silencieux de corpus |
| `include_citations: true` + affichage des sources | **Indispensable** | Les citations sont désactivées par défaut |
| Lecture de `sources_returned` et label sourcé/non sourcé | **Indispensable** | Gloo génère quand même sans source ; l’interface doit simplement le rendre visible |
| Affichage des cartes sources Gloo | **Indispensable** | Permet à l’utilisateur de vérifier sans construire un validateur sémantique interne |
| Références et Strong exacts hors RAG | **Indispensable** | Ce sont des identifiants déterministes et centraux au produit |
| Réponse non streamée | **Indispensable au premier MVP** | Permet de vérifier avant affichage et simplifie les erreurs |
| Limites, timeout, retry borné et mode exact dégradé | **Indispensable** | Les plafonds, `429` et erreurs provider existent |
| Exclusion des notes personnelles et de l’accompagnement pastoral | **Indispensable au premier MVP** | Réduit le périmètre juridique sans ajouter un moteur de règles local |
| 30–50 questions de contrôle avant le POC utilisateur | **Indispensable** | Vérifie rapidement la couverture française, historique et Strong de GlooGrounded |
| `tradition` choisie par l’utilisateur | Facultatif | L’omission donne une perspective chrétienne générale |
| Publisher Data Engine Bible Strong | Facultatif si le MVP n’a aucun corpus propre ; indispensable dès qu’il en a un | Donne contrôle de provenance sans construire un RAG |
| Search API séparée | Facultatif | Les citations des endpoints grounded suffisent au contrôle minimal ; Search donne plus de précision |
| Vérification sémantique de chaque affirmation | Facultatif pour un prototype fermé ; nécessaire avant usages doctrinaux à fort enjeu | Plus robuste, mais plus coûteux que le contrôle de spans |
| Fournisseur de modèle direct de secours | Facultatif | Le mode exact dégradé suffit à un MVP Gloo-first |
| Streaming | Facultatif et déconseillé au départ | Ajoute reprise, duplication et vérification tardive |
| RAG hybride Bible Strong | Non requis au MVP | Ne le construire que si les mesures Gloo montrent un écart bloquant |

Le minimum n’est donc pas « un appel Gloo direct depuis le mobile ». C’est **Gloo plus une petite enveloppe de vérité** : trois tools exacts, un routeur de Publisher, un gate de grounding/citations, un gestionnaire d’erreurs et un filtre de périmètre sensible.

## Comment lire cet audit

- **Fait documenté** : capacité ou engagement explicitement décrit par une source Gloo publique.
- **Non documenté** : aucune garantie publique suffisamment précise n’a été trouvée ; cela ne prouve pas que la capacité n’existe pas.
- **Inférence** : conséquence technique probable à valider en POC ou par écrit avec Gloo.
- **Recommandation** : décision proposée pour Bible Strong.

## 1. Ce que Gloo fournit réellement

### 1.1 Surfaces d’API

| Surface Gloo | Capacités documentées | Limite importante pour Bible Strong |
| --- | --- | --- |
| `POST /ai/v2/responses` | Format proche d’OpenAI Responses, texte, images, outils, sortie structurée, modération et `tradition` | Pas de RAG natif sur cette route ; état de conversation géré par le client ; les interventions « values-aligned » reviennent comme une réponse normale sans signal dédié documenté |
| `POST /ai/v1/grounded/responses` | RAG dans le format Responses, seuil de similarité, `sources_returned` | Encore en v1 ; pas de citations ni de `tradition` ; si aucune source ne passe le seuil, la génération continue sans source |
| `POST /ai/v2/chat/completions/grounded` | RAG, citations de sources, sélection/routage de modèle, `tradition` | Route spécifique non accessible par l’appel standard du SDK OpenAI ; citations désactivées par défaut ; pas de seuil de certitude documenté |
| Search API | Recherche dans le contenu ingéré et récupération de snippets/métadonnées | Le guide API décrit une recherche sémantique « near-text » ; pas d’interface publique documentée pour BM25, RRF, choix d’embeddings ou reranker |
| Tool use | Schémas de fonctions compatibles OpenAI ; le modèle retourne les appels à effectuer | Gloo n’exécute pas les outils Bible Strong et ne sécurise pas les requêtes Postgres ; le serveur applicatif reste responsable de l’autorisation et de la validation |

Sources : [Responses](https://docs.gloo.com/api-guides/responses), [Grounded Responses](https://docs.gloo.com/api-guides/grounded-responses), [Grounded Completions](https://docs.gloo.com/api-guides/grounded-completions), [Search](https://docs.gloo.com/api-guides/search), [Tool Use](https://docs.gloo.com/api-guides/tool-use).

Dans l’architecture prudente initialement envisagée par l’issue #334, Responses v2 sans RAG Gloo aurait conservé le maximum de contrôle. **Dans l’hypothèse Gloo-first retenue ici, Grounded Completions devient au contraire la surface principale**, car elle remplace le retrieval interne tout en réunissant citations, `tradition`, tools et routage.

### 1.2 Data Engine et ingestion

Gloo accepte fichiers, pages web, flux et contenus audio/vidéo, puis parse, découpe, vectorise et indexe automatiquement le contenu. Les éléments restent associés à leur parent et à ses métadonnées. Les API permettent de lister, retrouver, modifier la visibilité et supprimer définitivement un élément des bases vectorielles, du stockage de fichiers et des données liées. ([Content](https://docs.gloo.com/api-guides/content), [Upload Content](https://docs.gloo.com/api-guides/upload-content), [Manage Content](https://docs.gloo.com/api-guides/manage-content))

Le découpage est toutefois entièrement géré par Gloo : il **ne peut pas être désactivé et sa taille ou son chevauchement ne sont pas réglables**. Le seul levier est la granularité des éléments envoyés. ([How Chunking Works](https://docs.gloo.com/api-guides/chunking))

Conséquences pour Bible Strong :

- un verset, une entrée Strong, une notice de dictionnaire et un segment de commentaire ont des frontières sémantiques et juridiques précises ; il faudrait les pré-découper en éléments distincts ;
- les identifiants canoniques, versification, langue, traduction, tradition, détenteur de droits et règle d’affichage doivent rester dans Neon ;
- aucun export public des chunks, embeddings ou index n’est documenté ; les sources canoniques et le pipeline reproductible doivent rester chez Bible Strong ;
- la suppression Gloo est utile, mais ne remplace pas le registre interne de provenance et de droits.

La page commerciale du Data Engine mentionne désormais une « hybrid search », tandis que le guide et la requête Search publics décrivent surtout la recherche sémantique et n’exposent pas les composantes lexicales, leur fusion ou un reranker configurable. Il faut demander la spécification et mesurer le rappel sur les références bibliques et numéros Strong avant de considérer cette fonction équivalente au pipeline hybride de l’issue #334. ([Data Engine](https://studio.ai.gloo.com/data-engine), [Search](https://docs.gloo.com/api-guides/search))

## 2. Comparaison point par point avec l’issue #334

| Exigence Bible Strong | Couverture Gloo | Décision |
| --- | --- | --- |
| MVP entièrement en ligne | **Oui** | Compatible derrière Cloudflare ; ne pas appeler Gloo depuis l’application mobile |
| Cloudflare comme façade de confiance | **Complète, ne remplace pas** | Conserver authentification, quotas, redaction, cache contrôlé, politiques et traces côté Cloudflare |
| Neon/Postgres comme source de vérité | **Non** | Conserver les données bibliques, les droits et les identifiants dans Neon |
| Outils exacts passage/Strong/dictionnaire | **Infrastructure d’appel seulement** | Gloo peut demander un outil ; Bible Strong valide les arguments et exécute une requête en lecture seule prédéfinie |
| Recherche hybride lexical + vectoriel + fusion + reranking | **Délégué à Gloo, détails partiellement spécifiés** | Ne pas le reconstruire au MVP ; mesurer Gloo et ne réintroduire un pipeline interne qu’en cas d’échec bloquant |
| Réponse française depuis sources multilingues | **Plausible, non garanti** | Tester français, anglais, grec et hébreu ; garder la langue de preuve et l’extrait original dans la citation |
| Citations validées au niveau des affirmations | **Non** | Conserver les `source_span_ids`, le contrôle de présence et le refus côté Bible Strong |
| Respect des licences de sources | **Outils de droits disponibles, responsabilité client** | Conserver le registre de droits et filtrer avant retrieval et avant affichage |
| Garde-fous théologiques | **Partiel** | Utiliser éventuellement `tradition` comme signal supplémentaire, jamais comme politique théologique complète |
| Garde-fous pastoraux/crise | **Non démontré** | Garder classifieur, réponses statiques validées, escalade humaine et ressources locales dans Cloudflare |
| Confidentialité des notes, prières et recherches | **Contractuellement encadrable, détails à négocier** | Pas de données privées au POC ; DPA, sous-traitants, régions et rétention exigés avant production |
| Indépendance vis-à-vis des fournisseurs de modèles | **Partielle** | Utiliser auto-routing au MVP et un mode exact dégradé ; une route directe reste une option ultérieure |
| Évaluations et observabilité métier | **Partiel** | Exploiter les métriques Gloo mais conserver le jeu d’évaluation et les traces minimisées chez Bible Strong |

### 2.1 Outils exacts et sorties structurées

Gloo transmet des définitions de fonctions et retourne des appels d’outils, mais l’application exécute l’outil et renvoie le résultat. Sa documentation demande même, sur Responses, le schéma imbriqué de Chat Completions et indique que le schéma plat n’est pas accepté de façon fiable par tous les fournisseurs. Aucune garantie publique uniforme de mode `strict` n’est documentée. ([Tool Use](https://docs.gloo.com/api-guides/tool-use))

**Recommandation :** exposer uniquement des fonctions étroites telles que `get_passage`, `get_strong_entry`, `search_dictionary` et `search_corpus`; valider chaque appel avec un schéma local ; refuser les propriétés inconnues ; limiter volumes et délais ; n’accepter ni SQL libre, ni URL arbitraire, ni accès écriture. Le résultat du modèle doit encore passer par le schéma et les validateurs Bible Strong.

### 2.2 RAG, absence de source et citations

Trois comportements documentés sont décisifs :

1. `rag_publisher` omis utilise par défaut **`GlooGrounded`**, un corpus partagé assemblé par Gloo ; sa composition détaillée, ses versions et les licences source par source ne sont pas publiées dans la documentation examinée.
2. Grounded Responses poursuit la génération lorsque rien ne dépasse le seuil et renvoie `sources_returned: false`.
3. `sources_returned: true` signifie seulement que des sources ont atteint le modèle, pas que la réponse les suit.

Les citations de Grounded Completions contiennent titre, URL, auteur, éditeur, date et snippets, mais ne constituent pas une liaison documentée entre chaque affirmation et un passage précis. Gloo recommande explicitement un pipeline **Search → Generate → Verify**, attribue la vérification à l’application et conseille la Search API directe lorsque la précision compte. ([Grounded Responses](https://docs.gloo.com/api-guides/grounded-responses), [Grounded Completions](https://docs.gloo.com/api-guides/grounded-completions), [Building Trustworthy Grounded Applications](https://docs.gloo.com/best-practices/trustworthy-grounded-applications))

**Règles non négociables pour Bible Strong :**

- rendre `rag_publisher` obligatoire et ne jamais accepter la valeur implicite ;
- si `sources_returned` est faux, refuser ou afficher explicitement une réponse non sourcée, jamais une réponse normale ;
- mettre en mémoire tampon la génération tant que les références, citations et citations directes ne sont pas vérifiées ;
- ne pas afficher un titre, une citation ou une attribution qui n’est pas contenue dans les sources récupérées ;
- vérifier les droits d’affichage au moment de la recherche et au moment du rendu ;
- conserver des identifiants de spans internes, même si Gloo renvoie aussi ses citations.

### 2.3 Français et sources multilingues

Gloo indique que ses modèles multilingues peuvent interpréter et enrichir des documents dans plusieurs langues, tout en prévenant que les performances varient selon la langue. Aucune métrique publique n’a été trouvée pour le français biblique, la recherche croisée français–anglais, le grec, l’hébreu, les translittérations ou les numéros Strong. ([Model Types & Categories](https://docs.gloo.com/ai-learning-center/gloo-ai-101/model-types-and-categories))

La stratégie Gloo-first est : recherche exacte indépendante de la langue pour les références et Strong ; retrieval multilingue délégué à `GlooGrounded` ou au Publisher Data Engine ; réponse en français ; extraits de preuve dans leur langue d’origine avec traduction clairement étiquetée. Le POC doit mesurer séparément récupération et génération. Un RAG multilingue interne ne sera justifié que si ces mesures échouent.

## 3. Théologie, sécurité pastorale et attaques

### 3.1 Ce que fait le paramètre `tradition`

Gloo documente quatre valeurs : `evangelical`, `catholic`, `mainline` et `not_faith_specific`, ou une perspective chrétienne générale si le champ est omis. Grounded Completions affirme adapter à la fois la récupération et la génération à la tradition. ([Completions V2](https://docs.gloo.com/api-guides/completions-v2), [Grounded Completions](https://docs.gloo.com/api-guides/grounded-completions))

C’est utile pour réduire certains écarts de ton, mais insuffisant comme modèle théologique pour Bible Strong :

- les critères, sources, experts, versions et arbitrages derrière chaque tradition ne sont pas publiés ;
- la taxonomie ne représente pas toutes les sensibilités de l’audience ;
- Responses indique qu’une valeur invalide peut être ignorée « gracefully », donc sans échec dur ;
- aucune provenance n’est attachée aux décisions de garde-fou ;
- une réponse statique déclenchée par les garde-fous est renvoyée comme une réponse normale, sans indicateur distinct documenté.

**Recommandation :** la politique théologique Bible Strong doit rester versionnée, revue par des humains, testée et indépendante de Gloo. `tradition` peut être un paramètre secondaire explicite, jamais la source de vérité doctrinale ni un substitut aux citations.

### 3.2 Benchmark FAI-Christian

Gloo publie la méthodologie générale de FAI-Christian : environ 800 prompts, sept dimensions de flourishing et une notation par LLM juge combinant scores objectif, subjectif et tangentiel. Cela donne un signal intéressant de sélection de modèle. Ce benchmark n’évalue toutefois pas les unités spécifiques de Bible Strong : exactitude des références, fidélité d’une citation, langues bibliques, divergences confessionnelles, droit des sources ou conduite d’une crise pastorale. La documentation « Open » annonce modèles, données et outils sous licences ouvertes, mais les artefacts, versions, licences détaillées et jeux de test FAI-C n’étaient pas directement accessibles depuis les pages publiques examinées. ([Benchmarking](https://docs.gloo.com/learn-more/benchmarking), [Open](https://docs.gloo.com/learn-more/open))

**Décision :** utiliser les scores FAI-C comme donnée comparative, pas comme certificat. Exiger l’accès au dataset, aux rubriques, aux juges, à la version et aux résultats par langue ; maintenir un benchmark Bible Strong indépendant.

### 3.3 Jailbreak, injection et extraction

Gloo annonce des garde-fous d’entrée, des réponses alignées et une modération de sortie. La documentation publique ne décrit pas précisément :

- les catégories et seuils de politique ;
- leur comportement face à une injection contenue dans un document RAG ;
- la détection d’extraction du prompt système ou des secrets ;
- un identifiant de règle ou de version dans la réponse ;
- un mécanisme d’évaluation spécifique aux attaques théologiques et pastorales.

Par conséquent, Gloo ne remplace pas les contrôles de l’issue #334 : clé API uniquement côté Cloudflare, séparation instructions/données, aucun secret dans les prompts, allowlist des outils, validation stricte des arguments, limitation de sortie, refus hors sujet, filtrage des documents malveillants et tests adversariaux. Le prompt système doit être traité comme extractible ; la sécurité ne doit dépendre d’aucune instruction secrète.

### 3.4 Cas pastoraux à haut risque

Aucun protocole public complet n’a été trouvé pour suicide, violence, abus, emprise spirituelle, santé mentale, mineurs ou obligation de signalement. Les conditions Gloo rappellent que l’outil ne remplace pas le jugement humain et rendent le client responsable des protections et de la supervision. Les conditions AI Studio interdisent aussi de soumettre des informations de santé protégées au sens HIPAA. ([Gloo Services Terms](https://gloo.com/legal/entity-termsofservice), [AI Studio Supplemental Terms](https://gloo.com/legal/ai-studio-supplemental-terms-of-service))

**Décision :** pour ces situations, router avant le LLM vers des réponses statiques validées et des ressources locales ; ne jamais présenter l’IA comme pasteur, thérapeute ou autorité divine ; ne pas générer de diagnostic, prophétie personnelle ou absolution ; journaliser seulement les catégories nécessaires, sans le texte sensible.

## 4. Modèles, routage et dépendance fournisseur

Le catalogue public Gloo expose actuellement des modèles Anthropic, Google, OpenAI, open source et xAI, avec capacités, fenêtre de contexte et prix. L’API est largement compatible OpenAI et peut épingler un modèle, choisir une famille ou laisser Gloo router automatiquement. ([Supported Models](https://docs.gloo.com/api-guides/supported-models), [`GET /platform/v2/models`](https://platform.ai.gloo.com/platform/v2/models), [Libraries & SDKs](https://docs.gloo.com/api-guides/sdks-and-libraries))

Ce choix réduit le nombre d’intégrations directes, mais ne donne pas une indépendance totale :

- les champs `tradition`, `auto_routing`, `model_family`, les métadonnées de routage et les routes grounded sont spécifiques à Gloo ;
- certaines extensions nécessitent du HTTP direct ou des contournements de types TypeScript ;
- la Search API repose sur les concepts Publisher/Tenant/collection et le Data Engine propriétaire ;
- le chunking et les embeddings ne sont pas exportables ni configurables publiquement ;
- les conditions limitent le stockage ou la réplication des données récupérées via l’API hors usages autorisés ;
- Gloo peut modifier ou interrompre une API et les modèles sous-jacents restent soumis aux conditions des fournisseurs tiers.

Le cycle de vie des modèles est particulièrement important : Gloo vise au moins une semaine de présence au catalogue après dépréciation, mais le qualifie de **best effort**. Un identifiant déprécié peut être automatiquement redirigé vers un remplaçant ; le prix du remplaçant peut atteindre 1,3 fois l’ancien tarif sur chaque axe. ([Model Lifecycle](https://docs.gloo.com/api-guides/model-lifecycle))

**Réduction du lock-in compatible avec un MVP Gloo-first :**

- isoler l’appel Gloo dans un petit client serveur et ne pas exposer les objets Publisher/Tenant au domaine mobile ;
- utiliser auto-routing au POC, enregistrer le modèle réellement choisi et tester les changements ;
- surveiller quotidiennement le catalogue et déclencher les régressions avant migration ;
- garder les sources originales, droits, identifiants et évaluations hors de Gloo afin de pouvoir reconstruire un Publisher ou migrer plus tard ;
- obtenir par écrit le droit de conserver les sorties et citations nécessaires au produit ;
- tester export, suppression et reconstruction complète avant le contrat de production.

## 5. Confidentialité, sécurité et droits

### 5.1 Mesures publiques

Gloo déclare chiffrer les données en transit avec TLS 1.2+ et au repos avec AES-256, restreindre les accès, sauvegarder les données, réaliser audits internes, évaluations de vulnérabilité et tests d’intrusion tiers. Son programme est décrit comme conçu **par référence** à AICPA Trust Services Criteria, NIST CSF/AI RMF, ISO 27001 et ISO 42001 ; la page publique ne revendique pas une certification sur ce périmètre. ([Security Statement](https://gloo.com/legal/security-statement))

Le DPA :

- interdit l’entraînement ou le fine-tuning sur les données personnelles de l’organisation sans consentement écrit séparé ;
- prévoit les clauses contractuelles types UE/UK sur demande ;
- impose les obligations aux sous-traitants et fournit leur liste sur demande ;
- prévoit assistance aux droits des personnes et notification d’incident ;
- prévoit retour ou destruction à la demande ou dans les 60 jours après terminaison ;
- permet aux sauvegardes chiffrées de subsister jusqu’à leur cycle d’effacement, au maximum douze mois après terminaison ;
- permet de demander les preuves de conformité, avec rapport d’audit tiers tel qu’un SOC 2 Type II pouvant remplacer un audit sur site.

([Data Processing Agreement](https://gloo.com/legal/data-processing-agreement))

Ces clauses sont encourageantes, mais les sous-traitants, régions d’hébergement, flux par modèle, rétention des prompts/réponses/traces et délais exacts d’incident ne sont pas publiés avec le niveau nécessaire à Bible Strong. La page Data Engine indique que les options de résidence sont réservées aux contrats Enterprise. ([Data Engine](https://studio.ai.gloo.com/data-engine))

La mise en cache des prompts varie en outre selon le fournisseur : elle peut être implicite ou explicite et s’effectuer dans la chaîne amont. Une clause Gloo ne suffit donc pas sans engagements descendants pour chaque chemin de modèle. ([Prompt Caching](https://docs.gloo.com/api-guides/prompt-caching))

### 5.2 Contenu, entraînement et droits

Les conditions AI Studio indiquent que Bible Strong conserve ses droits sur son contenu et que l’entraînement/refinement nécessite une autorisation explicite distincte. Elles accordent néanmoins à Gloo une licence large pour héberger, transférer, traiter et améliorer le service ; certains usages entre offres et pour le RAG peuvent être désactivés par des réglages. La page commerciale Data Engine affirme pour sa part que le contenu n’est ni partagé entre organisations ni utilisé pour l’entraînement. Cette différence de formulation doit être résolue dans l’Order : réglages désactivés par défaut, verrouillables et auditables, avec primauté de la clause négociée. Les conditions rendent aussi Bible Strong responsable de posséder tous les droits et avertissent que les sorties peuvent reproduire des éléments contrôlés par des tiers. ([AI Studio Supplemental Terms](https://gloo.com/legal/ai-studio-supplemental-terms-of-service), [Data Engine](https://studio.ai.gloo.com/data-engine), [Gloo Services Terms](https://gloo.com/legal/entity-termsofservice))

Gloo propose un mécanisme de gestion et de distribution de droits par Publisher, avec accords distincts pour autoriser des tiers. Cela peut compléter le registre Bible Strong, mais ne prouve pas que les contenus du corpus partagé `GlooGrounded` sont licenciés pour l’affichage dans l’application. ([Manage Publishers](https://docs.gloo.com/studio/manage-publishers), [AI Studio Supplemental Terms](https://gloo.com/legal/ai-studio-supplemental-terms-of-service))

**Décisions :**

- ne jamais utiliser `GlooGrounded` dans le produit sans inventaire contractuel des sources et droits ;
- ne charger que les œuvres autorisées pour indexation, génération d’extraits et affichage ;
- désactiver explicitement tout partage inter-applications et tout entraînement ;
- obtenir une annexe par fournisseur de modèle sur entraînement, rétention, région et abus monitoring ;
- traiter les questions spirituelles, prières, notes et appartenances confessionnelles comme potentiellement sensibles ;
- ne transmettre au MVP que la requête minimisée et les extraits nécessaires, sans identifiant utilisateur direct.

### 5.3 Droit d’usage public et données sensibles

Deux textes publics créent un blocage juridique spécifique à une application grand public : les Gloo Services Terms accordent l’usage « solely for your own internal purposes and benefit », et l’AUP interdit par défaut de fournir l’Offering ou certains contenus à d’autres parties sans permission écrite. Les AI Studio Supplemental Terms interdisent aussi de rendre l’Offering disponible à un tiers, tandis que les pages produit vendent l’API pour des applications de production. **Il faut donc faire confirmer dans l’Order que Bible Strong peut transmettre les requêtes de ses utilisateurs, leur afficher les sorties et citations et les conserver, sans compte Gloo individuel.** ([Gloo Services Terms](https://gloo.com/legal/entity-termsofservice), [Acceptable Use Policy](https://gloo.com/legal/acceptable-use-policy), [AI Studio Supplemental Terms](https://gloo.com/legal/ai-studio-supplemental-terms-of-service))

L’AUP interdit également de fournir des informations sensibles avec une liste non exhaustive, tandis que la Privacy Statement de Gloo classe l’affiliation religieuse parmi les informations sensibles. Une question de méditation ou une prière peut révéler religion, santé, sexualité ou détresse. Les services ne sont par ailleurs pas destinés aux moins de treize ans. Ces points doivent être autorisés et encadrés par écrit avant un chatbot spirituel public, avec minimisation, base légale, règles pour mineurs et chemin local/statique pour les crises. ([Acceptable Use Policy](https://gloo.com/legal/acceptable-use-policy), [Privacy Statement](https://gloo.com/legal/privacy-statement))

## 6. Tarification, quotas et observabilité

### 6.1 Coût public

- Pay-as-you-go donne accès aux modèles/API, avec plafond de 100 USD par semaine.
- Pro coûte **25 USD/mois plus consommation**, donne accès au Data Engine/Search et plafonne à 800 USD par mois.
- Enterprise est contractuel et ajoute notamment support, limites et options personnalisées.
- Responses est facturé au tarif du modèle avec une majoration Studio de **6,5 %** sur chaque segment de tokens.
- Le retrieval grounded n’a pas de prix séparé, mais les sources injectées comptent comme tokens d’entrée.
- atteindre le plafond suspend l’API jusqu’au renouvellement ou à une intervention ; ce comportement est incompatible avec une production sans route de secours.

Sources : [Billing & Plans](https://docs.gloo.com/studio/billing), [pricing](https://studio.ai.gloo.com/pricing), [Responses pricing](https://docs.gloo.com/api-guides/responses#pricing--token-spend), [Grounded Responses](https://docs.gloo.com/api-guides/grounded-responses#pricing).

Les limites de requêtes ne sont pas une valeur universelle publique : elles dépendent de l’endpoint et du plan ; les réponses `429` et en-têtes peuvent varier. Les erreurs de fournisseur peuvent survenir après le début d’un stream. ([Rate Limits](https://docs.gloo.com/api-reference/general/limits))

### 6.2 Observabilité disponible et manquante

Le tableau de bord Gloo fournit requêtes, tokens, coûts, statut, endpoint, clé API et tendances ; les données sont proches du temps réel. L’historique Pay-as-you-go annoncé est de 90 jours, l’export détaillé et l’historique étendu sont Enterprise. Les analytics d’ingestion comptent fichiers, chunks, types et publishers. ([API Usage](https://docs.gloo.com/studio/api-usage), [Ingestion Analytics](https://docs.gloo.com/studio/ingestion-analytics))

Ne sont pas publiquement documentés comme fonctions exploitables : version exacte des garde-fous, raison d’une réponse statique, journal de retrieval reproductible, score de fidélité des affirmations, évaluation française, export de traces avec politique de redaction ou métriques pastorales.

**Recommandation :** conserver dans Bible Strong des traces minimisées par étape : classe de route, outils appelés, IDs de spans, modèle demandé/réel, latences, nombre de tokens, validation, refus et version de politique. Ne pas enregistrer par défaut le texte des notes, prières ou conversations.

### 6.3 Maturité et continuité

Gloo AI Studio a été lancé publiquement en mars 2026 et le changelog montre une évolution rapide : nouvelles générations Responses, migration d’authentification et ajouts fréquents de fournisseurs. C’est un signe d’investissement, mais aussi une surface encore jeune. Grounded Responses reste en v1 alors que Responses v2 est recommandé ; les conditions permettent de modifier ou interrompre l’API et aucun SLA public n’a été trouvé pour Pay-as-you-go ou Pro. ([annonce de lancement Gloo](https://investors.gloo.com/node/7126/pdf), [Changelog](https://docs.gloo.com/changelog), [Responses](https://docs.gloo.com/api-guides/responses), [AI Studio Supplemental Terms](https://gloo.com/legal/ai-studio-supplemental-terms-of-service))

La [page de statut officielle](https://status.ai.gloo.com) fournit un historique utile, mais ne constitue pas un engagement contractuel. Pour une fonctionnalité de lecture quotidienne, Bible Strong doit prévoir circuit breaker, mode exact sans IA et tests de reprise, même avec un contrat Enterprise. Une route fournisseur directe peut attendre une phase ultérieure.

## 7. Build vs buy

### Gloo peut remplacer

- les intégrations distinctes aux API de plusieurs fournisseurs de modèles ;
- une partie du failover fournisseur et du suivi des prix/capacités ;
- une première couche de modération et d’alignement chrétien ;
- pour le MVP Gloo-first, l’ingestion, le parsing, le chunking, l’embedding et la recherche des contenus non exacts ;
- un portail simple de gestion de contenus, publishers, rôles et consommation.

### Gloo complète, mais ne remplace pas

- Cloudflare comme frontière de sécurité, confidentialité, quotas et routage ;
- Neon comme source de vérité et moteur des recherches exactes ;
- les métadonnées de provenance et de droits ;
- la politique théologique et pastorale de Bible Strong ;
- les validateurs de schéma, références, citations et extraits ;
- le benchmark français, les tests adversariaux et le mode exact dégradé.

### Gloo ne couvre pas publiquement

- une exactitude garantie sur canon, versification, Strong, grec et hébreu ;
- une liaison vérifiée entre chaque affirmation et une citation ;
- un refus automatique quand le retrieval échoue ;
- un pipeline RRF/reranker configurable et auditable ;
- une taxonomie théologique suffisamment détaillée pour Bible Strong ;
- un protocole pastoral complet avec ressources françaises ;
- des garanties publiques précises de région, rétention par type de donnée, SLA et certifications ;
- un export complet et portable du Data Engine ;
- la composition et les droits du corpus partagé `GlooGrounded`.

## 8. Plan de POC et critères de sortie

### Phase 0 — réponses écrites avant tout contenu privé

Obtenir DPA signé, liste des sous-traitants, diagramme des flux par modèle, régions, rétentions, preuve de suppression, option no-training/no-sharing, droits de conservation des sorties/citations, SLA et procédure d’incident.

### Phase 1 — corpus public réduit

Charger un corpus dont les droits d’indexation et d’extrait sont certains, avec une granularité passage/entrée. Ne transmettre ni compte utilisateur, ni note, ni prière. Construire 200 à 500 cas : recherches exactes, lexicales, sémantiques, multilingues, contradictoires, sans réponse et adversariales.

### Phase 2 — comparaison contrôlée

Comparer :

- rappel@k du retrieval, séparé pour références, Strong et questions ouvertes ;
- fidélité factuelle et support de chaque affirmation ;
- exactitude et lisibilité des citations ;
- respect des droits et de la langue ;
- taux de refus correct lorsque la source manque ;
- qualité théologique évaluée par plusieurs relecteurs ;
- sécurité pastorale, jailbreak et prompt injection ;
- p50/p95, disponibilité, coût par scénario et variance après changement de modèle.

### Critères de non-passage

Pas de production si l’un des points suivants reste ouvert :

- absence d’autorisation écrite pour une application B2C publique et pour la conservation/affichage des sorties et citations ;
- données françaises ou européennes envoyées vers une région/sous-traitant non accepté ;
- prompts, réponses ou contenus utilisables pour entraînement/partage sans opt-in explicite ;
- impossibilité contractuelle de conserver les citations nécessaires au produit ;
- absence de suppression vérifiable ou d’inventaire des sous-traitants ;
- absence de modèle de droits pour chaque source ;
- pas de signal exploitable pour source manquante, modèle réel ou erreur de garde-fou ;
- qualité inférieure au pipeline Bible Strong sur références, Strong ou français ;
- absence de route de secours lors d’un plafond, `429`, retrait de modèle ou incident Gloo.

## 9. Questions prioritaires à poser à Gloo

### Données et contrats

1. Confirmez-vous par écrit le droit d’intégrer l’API dans une application B2C publique, de servir des utilisateurs sans compte Gloo et d’afficher/conserver sorties et citations ?
2. Quels sous-traitants et fournisseurs de modèles reçoivent prompts, réponses, contenus, embeddings, métadonnées et logs ?
3. Pour chacun, quelles régions, durées de rétention, finalités, politiques d’entraînement et mécanismes de transfert UE sont appliqués ?
4. La résidence UE couvre-t-elle Data Engine, modèles, logs, sauvegardes, support et analytics ?
5. Peut-on obtenir un mode contractuel zero-retention pour prompts/réponses et désactiver toute inspection humaine hors incident autorisé ?
6. Les réglages no-training/no-sharing sont-ils désactivés par défaut, verrouillables au niveau organisation et auditables par API ?
7. Le droit de stocker durablement réponses, citations, snippets et métadonnées dans Bible Strong est-il garanti malgré la restriction de cache/réplication des données API ?
8. Quel SLA, RTO/RPO, délai de notification d’incident et crédit de service sont proposés ?
9. Quel rapport SOC 2/ISO couvre précisément AI Studio et quelles exceptions récentes contient-il ?
10. L’AUP autorise-t-elle explicitement les requêtes révélant religion, santé ou détresse, et quelles règles s’appliquent aux mineurs ?

### Corpus et droits

11. Quelle est la liste versionnée des sources de `GlooGrounded`, avec licences, territoires, droits d’extrait, de génération et d’affichage mobile ?
12. Une requête peut-elle mélanger plusieurs Publishers tout en appliquant des droits différents par utilisateur, pays et type d’usage ?
13. Comment sont propagés licence, attribution obligatoire, longueur d’extrait, expiration et retrait jusque dans chaque citation ?
14. Peut-on exporter originaux, métadonnées, chunks, embeddings et index dans un format ouvert ; sinon, quel plan de sortie est contractuel ?
15. Les suppressions API couvrent-elles immédiatement caches, résultats dérivés et fournisseurs de modèles, et quelle preuve est fournie ?

### Retrieval et citations

16. Que signifie précisément « hybrid search » : BM25, dense, filtres, fusion, query expansion, reranker ? Quels réglages et scores sont exposés ?
17. Quels modèles d’embeddings et rerankers sont utilisés, dans quelles langues, et comment une migration d’index est-elle annoncée/testée ?
18. Peut-on imposer un fail-closed lorsque la source manque et interdire toute connaissance paramétrique du modèle ?
19. Existe-t-il une correspondance affirmation → span, un score d’entailment ou une API de vérification au-delà des snippets de citation ?
20. Comment sont évalués français, traduction croisée, grec, hébreu, translittérations, références bibliques et identifiants Strong ?

### Théologie, sécurité et exploitation

21. Qui définit et approuve `evangelical`, `catholic`, `mainline` et « general Christian » ; quelles sources, versions, controverses et procédures de recours sont utilisées ?
22. Peut-on fournir notre propre politique théologique versionnée, obtenir l’identifiant de la politique réellement appliquée et détecter chaque intervention ?
23. Quels tests couvrent prompt injection via RAG, extraction du prompt, exfiltration inter-tenant, appels d’outils malformés et contournement multilingue ?
24. Quelles catégories pastorales déclenchent blocage, réponse statique ou escalade, et quelles ressources françaises sont maintenues ?
25. Peut-on exporter FAI-C, ses rubriques, prompts, juges, versions et scores par cas afin de reproduire les résultats ?
26. Les modèles épinglés peuvent-ils être remplacés automatiquement ; peut-on interdire toute substitution avant validation ?
27. Quels quotas, limites de concurrence et plafonds sont garantis contractuellement, et comment éviter une coupure au plafond de consommation ?

## Conclusion

Gloo est plus qu’un simple « prompt chrétien » : il réunit gateway de modèles, ingestion, recherche, RAG, métadonnées de citations, rôles, facturation, modération et perspectives chrétiennes. C’est une base sérieuse pour accélérer un prototype.

Sous l’hypothèse Gloo-first, le meilleur compromis est donc **buy pour les modèles, le Data Engine, le retrieval, les citations brutes et les garde-fous ; build uniquement pour les passages/entités/Strong exacts, la sélection du Publisher, le gate `sources_returned`, le contrôle minimal des citations, les erreurs, les droits et le périmètre sensible**. Un RAG Bible Strong ne doit pas être construit par anticipation.

La décision finale doit reposer sur le POC et des engagements écrits. Sans droits explicites sur `GlooGrounded`, l’utiliser seulement en test interne ; pour un MVP public, limiter Gloo au Publisher Bible Strong alimenté par des sources autorisées, derrière Cloudflare et sans données utilisateur sensibles.

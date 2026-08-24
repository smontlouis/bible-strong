# Briques Cloudflare utiles à la recherche Bible Strong

_État de la recherche : 24 août 2026. Sources Cloudflare officielles uniquement. Aucun changement
d'architecture ni déploiement effectué._

## Décision

L'architecture actuelle est déjà la bonne pour la recherche biblique : **Workers AI pour produire
l'embedding Qwen, Neon PostgreSQL pour garder les données canoniques, `pgvector`/HNSW pour les
thèmes, full-text/trigram pour le lexical, fusion RRF dans une requête SQL, Hyperdrive et cache du
Worker pendant 24 heures**.

Il ne faut donc remplacer ni PostgreSQL par Vectorize, ni le moteur de recherche par AI Search.
Les améliorations Cloudflare utiles se classent ainsi :

| Priorité | Produit | Décision | Gain attendu |
|---|---|---|---|
| 1 | **AI Gateway** | Ajouter devant les appels Workers AI | Coût, erreurs et latence du modèle visibles ; plafond de dépense ; futur changement de fournisseur facilité |
| 1 | **Workers Analytics Engine** | Ajouter des métriques de recherche sans requête brute | Décider sur des p50/p95 et taux d'usage réels plutôt que par intuition |
| 2 | **Smart Placement** | Benchmark contrôlé en staging | Réduire éventuellement les allers-retours vers Neon lors des cache misses |
| 2 | **BGE reranker via Workers AI** | Challenger expérimental, pas activation générale | Améliorer l'ordre de quelques candidats thématiques ambigus si le benchmark FR/EN le prouve |
| 3 | **Vectorize** | Ne pas migrer maintenant | Challenger seulement si `pgvector` devient un goulot mesuré ou lors d'un index passage-level massif |
| 3 | **AI Search (bêta)** | Ne pas utiliser pour la recherche biblique actuelle | À reconsidérer pour un futur assistant documentaire/RAG sur commentaires, articles et transcriptions |

## Architecture observée dans le dépôt

Sur un cache miss, le Worker :

1. vérifie Firebase App Check et applique le rate limit ;
2. cherche une réponse dans le cache d'API révisionné, avec un TTL de 24 heures ;
3. sonde PostgreSQL pour éviter l'embedding lorsqu'un thème exact existe ;
4. appelle `@cf/qwen/qwen3-embedding-0.6b` via le binding Workers AI si une recherche sémantique est
   nécessaire ;
5. exécute la recherche hybride dans Neon via Hyperdrive ;
6. combine exact, stemming, fuzzy, thème lexical et thème vectoriel dans une grande CTE SQL ;
7. hydrate des versets canoniques, sans laisser le modèle générer une référence.

Les éléments correspondants sont visibles dans
[`worker.ts`](../../resource-service/src/runtime/worker.ts),
[`topicEmbedding.ts`](../../resource-service/src/search/topicEmbedding.ts),
[`bibleSearchRepository.ts`](../../resource-service/src/repositories/bibleSearchRepository.ts) et
[`resourceApiCache.ts`](../../resource-service/src/runtime/resourceApiCache.ts).

Cette séparation est importante : l'IA aide à **retrouver un identifiant de thème** ; PostgreSQL
reste responsable des filtres, des relations thématiques, de l'ordre canonique, des versions et du
texte effectivement affiché.

## 1. Workers AI : conserver Qwen, tester le reranking séparément

### Qwen embedding

Le binding Workers AI est exactement adapté à l'opération actuelle. Le modèle Qwen expose une
fenêtre de 8 192 tokens et coûte actuellement 0,012 USD par million de tokens d'entrée. Les requêtes
de Bible Strong sont courtes ; le coût d'embedding n'est donc probablement pas le facteur dominant.
La priorité doit rester la qualité du retrieval FR/EN et la latence sur un cache miss.

Source : [Qwen3 Embedding 0.6B sur Workers AI](https://developers.cloudflare.com/workers-ai/models/qwen3-embedding-0.6b/),
[tarification Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/).

Workers AI indique également que le contenu client n'est ni communiqué à d'autres clients ni
utilisé pour entraîner ou améliorer les modèles et services sans consentement explicite. Cela ne
dispense pas Bible Strong de minimiser les logs : une recherche comme « je n'arrive plus à vivre »
reste une donnée personnelle sensible même si elle ne sert pas à l'entraînement.

Source : [utilisation des données Workers AI](https://developers.cloudflare.com/workers-ai/platform/data-usage/).

### BGE reranker

Cloudflare propose `@cf/baai/bge-reranker-base`. Contrairement à un modèle d'embedding, il reçoit la
requête et une petite liste de contextes, puis attribue directement un score de pertinence. Il coûte
actuellement 0,0031 USD par million de tokens d'entrée. AI Search ne liste d'ailleurs que ce modèle
comme reranker Workers AI supporté ; il n'y a pas de « Qwen reranking » managé équivalent dans le
catalogue vérifié.

Sources : [BGE reranker sur Workers AI](https://developers.cloudflare.com/workers-ai/models/bge-reranker-base/),
[modèles supportés par AI Search](https://developers.cloudflare.com/ai-search/configuration/models/supported-models/).

Le reranker peut avoir un intérêt, mais uniquement **après** le retrieval existant :

- conserver les résultats exacts et Strong avant toute IA ;
- ne lui envoyer que les 10 à 30 meilleurs thèmes candidats avec leur libellé et leurs alias ;
- l'activer seulement pour les formulations naturelles ou ambiguës, jamais pour `H430`, `G26`, une
  référence BCV ou une phrase exacte ;
- comparer NDCG/MRR et taux de succès sur la pile QA FR/EN avant activation ;
- conserver le classement actuel si le reranker échoue ou dépasse son budget temps.

Il ne faut pas lui envoyer des dizaines de versets complets par défaut. Cela ajouterait une
inférence séquentielle sur chaque cache miss, compliquerait l'explicabilité et pourrait perturber
l'ordre canonique. Le bénéfice doit être démontré sur les requêtes difficiles, par exemple « comment
gérer la peur du lendemain ? », et non sur les requêtes déjà résolues par les alias et Qwen.

## 2. AI Gateway : le meilleur ajout immédiat, avec garde-fous de confidentialité

Le binding `env.AI.run()` accepte un troisième argument `gateway`. AI Gateway peut alors fournir
les métriques de coût, tokens, durée et erreurs, des limites de dépense, ainsi que des métadonnées
techniques par appel. Ses fonctions centrales d'analytics, cache et rate limiting sont actuellement
annoncées sans surcoût propre.

Sources : [AI Gateway depuis le binding Workers AI](https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/),
[fonctionnalités AI Gateway](https://developers.cloudflare.com/ai-gateway/features/),
[tarification AI Gateway](https://developers.cloudflare.com/ai-gateway/reference/pricing/).

### Configuration recommandée

- Gateway dédiée, par exemple `bible-strong-search`.
- **Pas de payload brut persistant** : configurer les logs en metadata-only, ou désactiver les logs
  de payload si cette granularité n'est pas disponible dans le chemin de binding retenu.
- Métadonnées autorisées : environnement, révision du contrat embedding, cache miss/hit, durée,
  statut et classe de requête. Pas de texte de recherche, pas d'identifiant utilisateur stable.
- Plafond de dépense global Workers AI pour éviter une dérive de coût.
- `skipCache: true` pour l'embedding dans un premier temps.
- Conserver le rate limiter actuel du Worker, situé après App Check, comme défense applicative
  principale.

AI Gateway enregistre par défaut les prompts et réponses dans ses logs. Cloudflare permet de couper
la collecte ou de ne garder que les métadonnées sans payload. Ce réglage est une condition de mise
en production pour Bible Strong, pas une optimisation facultative.

Source : [logs AI Gateway et contrôle des payloads](https://developers.cloudflare.com/ai-gateway/observability/logging/).

Le cache AI Gateway n'apporte pas grand-chose ici. Il ne frappe que sur des requêtes identiques ;
Bible Strong cache déjà la **réponse de recherche entière** pendant 24 heures avec une clé qui tient
compte de la version de la Bible, de l'index thématique, du contrat embedding et du ranking. Mettre
un second cache sur le vecteur complexifierait l'invalidation pour un gain inférieur. Cloudflare
précise en outre que son cache AI Gateway est volatil.

Source : [cache AI Gateway](https://developers.cloudflare.com/ai-gateway/features/caching/).

AI Gateway ne remplace ni Firebase App Check ni les contrôles du Worker : il protège et observe
l'inférence, pas l'accès légitime de l'application à l'API biblique.

## 3. Vectorize : techniquement compatible, architecturalement inutile aujourd'hui

Vectorize accepterait sans difficulté les vecteurs Qwen actuels : jusqu'à 1 536 dimensions, 20
millions de vecteurs par index, `topK` 100 sans payloads, 10 KiB de métadonnées et jusqu'à dix index
de métadonnées par index vectoriel. Il propose aussi un binding Worker direct et du filtrage avant
le `topK`.

Sources : [limites Vectorize](https://developers.cloudflare.com/vectorize/platform/limits/),
[filtrage de métadonnées](https://developers.cloudflare.com/vectorize/reference/metadata-filtering/),
[présentation Vectorize](https://developers.cloudflare.com/vectorize/get-started/intro/).

Mais l'index de thèmes de Bible Strong est petit et `pgvector` possède déjà un index cosinus HNSW.
Les résultats vectoriels doivent immédiatement rejoindre les tables de thèmes, sources, relations,
passages, publications et versets. Les laisser dans PostgreSQL permet une seule transaction de
publication et une seule requête hybride. Vectorize introduirait :

- une copie de l'index à synchroniser ;
- une cohérence éventuelle et un protocole de bascule de génération ;
- un appel réseau, suivi d'une requête PostgreSQL d'hydratation ;
- deux moteurs de classement à benchmarker et observer ;
- une gestion séparée des suppressions et révisions.

La tarification Vectorize est faible, mais ce n'est pas une raison suffisante pour ajouter ce coût
de cohérence. Elle dépend des dimensions stockées et interrogées ; sur Workers Paid, les 50 premiers
millions de dimensions interrogées et 10 premiers millions stockées sont incluses chaque mois.

Source : [tarification Vectorize](https://developers.cloudflare.com/vectorize/platform/pricing/).

### Seuil de reconsidération

Créer un prototype Vectorize en lecture parallèle seulement si l'un de ces signaux apparaît :

- p95 de la partie vectorielle PostgreSQL au-dessus de la cible après `EXPLAIN ANALYZE` et tuning
  HNSW ;
- charge Neon imputable à la recherche vectorielle ;
- passage à des embeddings par verset, paragraphe, commentaire ou ressource multimédia en centaines
  de milliers ou millions de chunks ;
- besoin démontré d'une recherche vectorielle distribuée indépendante des jointures SQL.

Le challenger doit retourner les mêmes `topic_id`, être exécuté en shadow traffic et gagner sur
latence **et** qualité avant toute migration. Le coût seul ne doit pas déclencher le changement.

## 4. AI Search : bon produit pour un futur corpus documentaire, mauvais remplacement actuel

AI Search est désormais un service managé qui ingère un site, un bucket R2 ou des documents uploadés,
les découpe et construit des index keyword/vector. Il sait faire recherche vectorielle, keyword ou
hybride, filtrage, boosting, réécriture de requête, reranking et génération optionnelle. Son stockage
intégré s'appuie sur R2 et Vectorize.

Sources : [fonctionnement d'AI Search](https://developers.cloudflare.com/ai-search/concepts/how-ai-search-works/),
[configuration AI Search](https://developers.cloudflare.com/ai-search/configuration/),
[stockage intégré](https://developers.cloudflare.com/ai-search/configuration/data-source/built-in-storage/).

Il couvre donc beaucoup de fonctions déjà implémentées, mais avec un modèle documentaire générique.
Pour la recherche actuelle, cela ferait perdre ou dupliquer les propriétés les plus importantes :

- identité exacte `version/livre/chapitre/verset` ;
- ordre canonique et deutérocanoniques ;
- filtres version/canon/livre/langue ;
- résultats Strong et BCV ;
- priorité déterministe de l'exact avant le fuzzy et le sémantique ;
- transaction de publication entre thèmes, relations et passages ;
- explication `lexical/topic/semantic/hybrid` déjà présente dans le contrat API.

AI Search ne propose que cinq champs de métadonnées personnalisés par instance et change son modèle
d'embedding seulement lors de la création d'une instance. Ses « Smart Defaults » peuvent évoluer
automatiquement. Ces contraintes sont acceptables pour des documents, moins pour un moteur biblique
versionné où la reproductibilité est un objectif explicite.

Sources : [limites et prix AI Search](https://developers.cloudflare.com/ai-search/platform/limits-pricing/),
[modèles AI Search](https://developers.cloudflare.com/ai-search/configuration/models/),
[métadonnées AI Search](https://developers.cloudflare.com/ai-search/configuration/indexing/metadata/).

Le service est encore en bêta ouverte et gratuit dans ses limites au 24 août 2026 ; Cloudflare
annonce qu'une tarification sera communiquée au moins 30 jours avant son entrée en vigueur. Cette
incertitude renforce la décision de ne pas déplacer un moteur de production fonctionnel.

### Cas d'usage futur pertinent

AI Search devient intéressant pour la future « partie 3 » si celle-ci vise un assistant qui répond
à partir de **documents longs** : commentaires, études, articles, transcriptions audio/vidéo ou FAQ.
Dans ce cas, créer une instance séparée et appeler d'abord son API `search` sans génération permettrait
de tester le retrieval. Le LLM pourrait ensuite recevoir les chunks avec leurs sources. La Bible et
les références exactes resteraient servies par le moteur actuel.

Il ne faut pas activer directement son endpoint public pour l'application mobile. Le Resource
Worker doit rester la façade, appliquer App Check, décider quels corpus interroger et contrôler les
citations. AI Search peut exiger Cloudflare Access, mais Access n'est pas un substitut direct à
l'attestation mobile Firebase déjà déployée.

## 5. Smart Placement : un benchmark peu coûteux à mener

Cloudflare exécute normalement le Worker près de l'utilisateur. Smart Placement peut le déplacer
près des backends lorsque cela réduit la durée totale. Cloudflare le recommande surtout lorsque le
Worker contacte plusieurs backends ou effectue plusieurs allers-retours ; Hyperdrive précise que le
placement est particulièrement utile avec plusieurs requêtes SQL séquentielles et n'améliore pas le
temps total d'une requête SQL unique.

Sources : [placement des Workers](https://developers.cloudflare.com/workers/configuration/placement/),
[fonctionnement d'Hyperdrive](https://developers.cloudflare.com/hyperdrive/concepts/how-hyperdrive-works/).

Bible Strong est entre les deux cas : la recherche principale est une seule grande CTE, mais une
recherche sémantique peut faire une sonde exacte PostgreSQL, un appel Workers AI, puis la CTE. Le
cache 24 h élimine le chemin pour les requêtes répétées. Il faut donc activer `placement.mode =
"smart"` en staging, comparer les cache misses depuis plusieurs régions et ne le conserver que si le
p50/p95 bout en bout s'améliore. Une amélioration de la seule latence SQL ne suffit pas si le temps
utilisateur total régresse.

## 6. Workers Analytics Engine : mesurer sans collecter les recherches

Le Worker produit déjà des logs structurés avec durée, nombre de requêtes SQL et état du cache, mais
les logs sont échantillonnés à 10 %. Workers Analytics Engine permet d'écrire des datapoints à
cardinalité non bornée depuis un Worker et de les agréger avec SQL. Il emploie un échantillonnage
adaptatif ; il convient donc aux tendances et percentiles, pas à un audit événementiel exact.

Sources : [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/),
[échantillonnage](https://developers.cloudflare.com/analytics/analytics-engine/sampling/),
[tarification](https://developers.cloudflare.com/analytics/analytics-engine/pricing/).

Un datapoint `bible_search` devrait contenir uniquement :

- temps total, temps embedding et temps SQL ;
- cache `HIT/MISS/BYPASS` ;
- succès/échec/timeout de l'embedding ;
- nombre de candidats lexicaux, thématiques et vectoriels ;
- nombre de résultats et type de premier résultat ;
- langue, nombre de versions et présence des filtres, sous forme de catégories bornées ;
- révisions du contrat embedding et du ranking.

Ne pas inclure la requête brute, son hash, l'UID Firebase ni un identifiant stable d'appareil. Même
un hash de requête permettrait de relier des recherches rares et sensibles. Les métriques agrégées
doivent répondre à quatre décisions concrètes :

1. combien de recherches atteignent réellement Qwen ;
2. quelle part échoue ou revient au lexical ;
3. quel est le p95 cache miss par région et par chemin ;
4. quelles requêtes **de la QA synthétique**, et non quelles requêtes utilisateur, justifient un
   reranker ou Vectorize.

## Plan recommandé

### Maintenant

1. Brancher Qwen sur une AI Gateway dédiée avec payload logging désactivé, cache désactivé et plafond
   de dépense.
2. Ajouter Analytics Engine avec les métriques non sensibles ci-dessus.
3. Laisser Workers AI, Neon/`pgvector`, Hyperdrive, RRF et le cache 24 h inchangés.

### Après une période de mesure

1. Tester Smart Placement en staging sur des cache misses multi-régions.
2. Ajouter `bge-reranker-base` derrière un feature flag sur la pile QA uniquement ; comparer qualité
   et latence avec le classement actuel.
3. Ne promouvoir le reranker que si son gain FR **et** EN est net et si le budget p95 est respecté.

### Plus tard, pour la partie conversationnelle

1. Prototyper AI Search sur un petit corpus documentaire non canonique et sourcé.
2. Garder la récupération des versets exacts dans le moteur PostgreSQL actuel.
3. Challenger `pgvector` avec Vectorize seulement si les métriques montrent une limite réelle ou si
   le corpus vectoriel change d'ordre de grandeur.

## Conclusion

Le meilleur usage de Cloudflare n'est pas d'empiler davantage de moteurs de recherche. Bible Strong
utilise déjà la brique la plus pertinente — Workers AI — au bon endroit, tandis que PostgreSQL garde
la vérité biblique et le classement explicable. Le prochain gain vient de **l'observabilité et de la
maîtrise de l'inférence** avec AI Gateway et Analytics Engine. Le reranker, Vectorize et AI Search
doivent rester des challengers mesurés, chacun réservé au problème qu'il résout réellement.

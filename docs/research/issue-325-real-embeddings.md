# De vrais embeddings multilingues pour la recherche thématique — issue #325

_État de la recherche : 24 août 2026. Sources primaires uniquement. Aucun déploiement effectué._

## Recommandation

Remplacer `bible-strong-topic-hash-v1` par **Qwen3-Embedding-0.6B en 1 024 dimensions**, servi par
Cloudflare Workers AI, est le meilleur choix pragmatique actuel.

- Modèle : `@cf/qwen/qwen3-embedding-0.6b`.
- Documents : noms canoniques EN + alias EN + alias FR contrôlés, sans instruction de requête.
- Requêtes : format asymétrique Qwen explicite avec instruction anglaise stable :
  `Instruct: Given a French or English Bible-topic query, retrieve the most relevant biblical topic.`
  puis `Query: <requête normalisée>` sur la ligne suivante.
- Stockage initial : `pgvector vector(1024)` dans le PostgreSQL existant, avec distance cosinus.
- Recherche : exact lexical et alias contrôlés d'abord, puis top-K vectoriel, puis fusion RRF ; les
  embeddings ne génèrent jamais de texte ni de référence.
- Ingestion de production : Workers AI Batch depuis la commande de publication, avec le même modèle
  et le même contrat que l'embedding online de requête.
- Développement immédiat : interface de provider et benchmark local seulement ; aucune activation
  Cloudflare/Neon de production sans autorisation distincte.

Qwen3-Embedding-0.6B est celui des quatre candidats qui combine le meilleur résultat multilingue
publié comparable, une licence Apache-2.0, un endpoint Workers AI déjà disponible au même prix que
BGE-M3 et un vrai contrat asymétrique query/document. Son avantage de benchmark ne dispense pas du
test décisif : requêtes françaises contre le catalogue de thèmes principalement anglais.

**Alternative de repli : BGE-M3.** Il est MIT, disponible sur Workers AI au même tarif, ne demande
pas d'instruction et possède une documentation cross-lingue solide. Le retenir si Qwen ne gagne pas
clairement le corpus Bible Strong ou si son endpoint instruction-aware se révèle instable.

## Contexte vérifié dans le dépôt

La première implémentation stocke un vecteur `real[256]` produit par un feature-hash déterministe.
Elle connaît quelques équivalences FR/EN codées à la main (`anxiété → anxiety`, `deuil → grief`,
etc.) et calcule le cosinus par `unnest` SQL. Le schéma a déjà les bonnes notions de migration :
`topic_id`, `model`, `dimensions`, `embedding`.

Le corpus thématique annoncé est d'environ 11 500 sujets. À 1 024 `float32`, les valeurs brutes
représentent environ 47 Mo (`11 500 × 1 024 × 4`), avant overhead et index. Ce volume est petit. Le
premier objectif n'est donc pas la distribution horizontale, mais la qualité cross-lingue, la
reproductibilité du modèle et un chemin de publication atomique.

L'index reste dérivé : il récupère des `topic_id`, puis les tables thématiques fournissent les
références canoniques et le texte de la Bible sélectionnée. Un embedding erroné peut donc mal
classer un thème, mais ne peut pas inventer un verset.

## Comparaison des modèles

Les chiffres MTEB ci-dessous proviennent des model cards ou papiers des producteurs. Ils ne sont
pas une mesure directe de « requête FR → catalogue biblique EN ». Aucun des quatre producteurs ne
publie ce slice exact ; il faut le mesurer localement.

| Modèle | Qualité multilingue publiée | Dimensions / contexte canonique | Licence | Disponibilité utile |
|---|---|---|---|---|
| **Qwen3-Embedding-0.6B** | MTEB Multilingual v2 : 64,33 mean-task, 56,00 mean-type, 64,64 retrieval | 1 024, MRL 32–1 024 ; 32k dans la model card, 8 192 sur l'endpoint Workers AI | Apache-2.0 | Workers AI + poids locaux/TEI |
| **BGE-M3** | 59,56 mean-task, 52,18 mean-type dans la comparaison MTEB de Qwen ; évaluations MIRACL et MKQA cross-lingues | 1 024 ; 8 192 canonique | MIT | Workers AI + FlagEmbedding/local |
| **EmbeddingGemma 300M** | MTEB Multilingual v2 : 61,15 mean-task, 54,31 mean-type à 768d | 768, MRL 512/256/128 ; 2 048 canonique | Gemma Terms | Workers AI + local/on-device/Vertex |
| **multilingual-e5-large** | modèle éprouvé ; BEIR 51,4 dans le dépôt E5, entraînement multilingue incluant des paires traduites | 1 024 ; troncation à 512 | MIT | local / fournisseur tiers ; absent du catalogue Workers AI vérifié |

### Qwen3-Embedding-0.6B

La model card officielle annonce plus de 100 langues, 0,6 milliard de paramètres, 1 024 dimensions,
MRL jusqu'à 32 dimensions et 32k tokens. Elle rapporte en MTEB Multilingual v2 un score retrieval
de 64,64, contre 57,12 pour `multilingual-e5-large-instruct` et 54,60 pour BGE-M3 dans son tableau.
Les requêtes bénéficient d'une instruction, les documents n'en reçoivent pas ; Qwen rapporte un
gain généralement compris entre 1 et 5 % avec instruction et recommande de rédiger celle-ci en
anglais dans un contexte multilingue.

Sources : [model card Qwen](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B),
[papier Qwen3 Embedding](https://arxiv.org/abs/2506.05176).

Workers AI expose le modèle sous `@cf/qwen/qwen3-embedding-0.6b`, avec un champ `instruction` et une
instruction web-search par défaut. Son endpoint annonce actuellement 8 192 tokens, donc inférieur
aux 32k des poids canoniques ; 8 192 est le plafond opérationnel à retenir sur Cloudflare. Les
libellés thématiques sont de toute façon très loin de cette limite.

Le test local a montré que le champ `instruction` de l'endpoint ne modifiait pas les vecteurs dans
notre chemin Wrangler, alors que le format canonique explicite `Instruct: …\nQuery: …` changeait le
classement et l'améliorait nettement. Le contrat Bible Strong v2 encode donc explicitement ce format
dans le texte de requête au lieu de dépendre du champ optionnel du fournisseur.

Source : [modèle Qwen sur Workers AI](https://developers.cloudflare.com/workers-ai/models/qwen3-embedding-0.6b/).

### BGE-M3

BGE-M3 produit un dense vector de 1 024 dimensions, accepte jusqu'à 8 192 tokens et couvre plus de
100 langues. Le même modèle peut produire sparse et ColBERT, mais l'API Bible Strong n'a besoin que
du dense vector ; la recherche lexicale PostgreSQL joue déjà le rôle du signal sparse. La model
card précise qu'aucune instruction de requête n'est requise.

Le papier et la model card évaluent MIRACL multilingue et MKQA cross-lingue. C'est une preuve plus
directe de capacité cross-lingue que la seule moyenne MTEB, mais toujours pas une garantie sur la
terminologie biblique FR/EN.

Sources : [model card BGE-M3](https://huggingface.co/BAAI/bge-m3),
[papier BGE-M3](https://arxiv.org/abs/2402.03216).

Workers AI expose `@cf/baai/bge-m3` à 1 024 dimensions. Sa page affiche un contexte de 60 000
tokens, en contradiction avec les 8 192 de la model card BAAI ; il faut conserver 8 192 comme limite
sûre tant qu'un test contractuel Cloudflare n'a pas expliqué cette différence.

Source : [BGE-M3 sur Workers AI](https://developers.cloudflare.com/workers-ai/models/bge-m3/).

### multilingual-e5-large

`multilingual-e5-large` reste un excellent baseline : 1 024 dimensions, 24 couches, licence MIT et
entraînement multilingue à grande échelle. Il exige cependant les préfixes `query: ` et `passage: `,
y compris pour les langues non anglaises ; la model card prévient que les omettre dégrade la
performance. Les entrées sont tronquées à 512 tokens.

Il n'est pas présent dans le catalogue Workers AI vérifié. Le choisir imposerait donc de
l'auto-héberger ou d'ajouter un fournisseur uniquement pour les embeddings. Pour des thèmes courts,
sa limite de contexte ne gêne pas ; son coût opérationnel supplémentaire, oui.

Sources : [model card multilingual-e5-large](https://huggingface.co/intfloat/multilingual-e5-large),
[dépôt Microsoft E5](https://github.com/microsoft/unilm/tree/master/e5),
[rapport multilingue E5](https://arxiv.org/abs/2402.05672).

### EmbeddingGemma 300M

EmbeddingGemma est le meilleur candidat compact : 308M paramètres, plus de 100 langues, 768
dimensions tronquables à 512/256/128 par MRL, contexte 2 048 et déploiement local possible avec
moins de 200 Mo de RAM après quantification selon Google. À 768 dimensions, Google rapporte 61,15
mean-task et 54,31 mean-type sur MTEB Multilingual v2.

Son contrat de prompting doit être respecté : requête
`task: search result | query: {content}`, document
`title: {title ou none} | text: {content}`. Les poids utilisent les Gemma Terms, pas MIT/Apache ;
Google indique un usage commercial responsable possible, mais l'acceptation de ces termes doit être
enregistrée.

Sources : [model card Google](https://ai.google.dev/gemma/docs/embeddinggemma/model_card),
[présentation](https://ai.google.dev/gemma/docs/embeddinggemma),
[papier](https://arxiv.org/abs/2509.20354).

Workers AI expose désormais `@cf/google/embeddinggemma-300m`. Cloudflare documente 768 dimensions
et, dans AI Search, un plafond de 512 tokens — plus bas que les 2 048 canoniques. La page tarifaire
Workers AI actuelle ne donne pas de ligne de prix explicite pour ce modèle : il faut vérifier le
tarif effectif avant de le sélectionner.

Sources : [modèle Workers AI](https://developers.cloudflare.com/workers-ai/models/embeddinggemma-300m/),
[changelog Cloudflare](https://developers.cloudflare.com/changelog/post/2026-04-09-new-workers-ai-models/).

## Ingestion et requête ne sont pas le même input

Le même modèle, la même dimension et la même convention de normalisation doivent être utilisés des
deux côtés. En revanche, le texte formaté est asymétrique.

### Document thématique à l'ingestion

Construire une représentation versionnée et déterministe, par exemple :

```text
Canonical biblical topic: Forgiveness
English aliases: pardon; forgiving others
Validated French aliases: pardon; pardonner; réconciliation
```

N'inclure que les données publiables et les alias validés. Ne pas concaténer les milliers de
références associées : le document représente le concept, tandis que les références restent dans
`thematic_topic_passages`. Stocker avec le vecteur :

- identifiant exact du modèle ;
- dimension ;
- version du contrat de prompt/document ;
- hash SHA-256 du texte d'entrée ;
- date, fournisseur et révision d'import.

Pour Qwen, le document n'a pas d'instruction. Pour E5 il prend `passage: ` ; pour EmbeddingGemma le
format document est obligatoire. Changer de modèle ou de format impose de recalculer **tout**
l'index, jamais de mélanger deux espaces vectoriels.

### Requête online

Le Worker envoie uniquement la requête nettoyée au modèle, avec l'instruction Qwen anglaise figée.
Il ne traduit pas la requête française et n'appelle aucun LLM génératif. Le résultat est un tableau
de nombres ; PostgreSQL récupère les topic IDs proches, puis le code existant hydrate les références.

Cloudflare indique que le contenu client Workers AI n'est pas utilisé pour entraîner ses modèles
ni améliorer ses services sans consentement explicite. Le texte de requête ne doit néanmoins pas
être loggé, puisqu'il peut révéler une préoccupation spirituelle personnelle.

Source : [politique de données Workers AI](https://developers.cloudflare.com/workers-ai/platform/data-usage/).

### Reproductibilité entre batch et online

Le chemin de production le plus sûr utilise Workers AI des deux côtés :

1. CLI de publication → Batch API Workers AI pour les 11,5k documents ;
2. validation dimension/norme/nombre/hash ;
3. insertion dans une nouvelle génération d'index ;
4. benchmark de canaris FR/EN ;
5. activation atomique ;
6. Worker → même identifiant de modèle pour chaque requête.

L'API Batch est asynchrone, accepte un payload total inférieur à 10 Mo et garantit une exécution
ultérieure lorsque la capacité immédiate manque. BGE-M3 expose explicitement un schéma Batch ; la
page Qwen ne le marque pas actuellement. Il faut donc tester la disponibilité Batch de Qwen avant
d'en dépendre ; sinon, utiliser des lots synchrones bornés avec reprise idempotente.

Source : [Workers AI Batch API](https://developers.cloudflare.com/workers-ai/features/batch-api/).

Une ingestion locale avec les poids Hugging Face et des requêtes Workers AI est acceptable pour un
benchmark, pas automatiquement pour la production : quantification, pooling ou version de runtime
peuvent déplacer les vecteurs. Si ce chemin est retenu, un test de parité doit comparer normes,
cosinus et classement de canaris produits localement et par Cloudflare.

## Stockage : pgvector d'abord, Vectorize en challenger

### PostgreSQL / pgvector recommandé

Remplacer `real[]` et `topic_cosine_similarity()` par `vector(1024)` et l'opérateur cosinus
`<=>`. `pgvector` supporte exact search, HNSW, IVFFlat et jusqu'à 2 000 dimensions indexées en
`vector`, donc tous les candidats entrent sans réduction. Neon l'active avec
`CREATE EXTENSION vector`.

Sources : [pgvector officiel](https://github.com/pgvector/pgvector),
[support Neon](https://neon.com/docs/ai/ai-concepts).

Avec 11,5k sujets, commencer par la recherche exacte pgvector, qui conserve un recall parfait, et
mesurer. Ajouter HNSW `vector_cosine_ops` seulement si le p95 au pic manque la cible ; HNSW améliore
le compromis vitesse/recall mais coûte mémoire et temps de construction. Cette approche garde
topics, provenance, publication et vecteurs dans une transaction et fonctionne via le chemin
Hyperdrive/PostgreSQL existant. Cloudflare recommande `node-postgres` pour Hyperdrive.

Sources : [index HNSW pgvector](https://github.com/pgvector/pgvector#hnsw),
[connexion PostgreSQL Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/).

### Vectorize si la latence globale le justifie

Vectorize accepte jusqu'à 1 536 dimensions float32, 20 millions de vecteurs par index, top-K 100
sans valeurs/métadonnées et des upserts de 1 000 vecteurs via Worker ou 5 000 via HTTP. Les 11,5k
vecteurs tiennent donc très largement. Le coût est par dimensions stockées et interrogées, sans
egress.

Sources : [limites Vectorize](https://developers.cloudflare.com/vectorize/platform/limits/),
[tarifs Vectorize](https://developers.cloudflare.com/vectorize/platform/pricing/).

À 1 024 dimensions, 11,5k sujets représentent 11,776 millions de dimensions stockées. Sur Workers
Paid, les 10 premiers millions sont inclus. À titre indicatif, 100k recherches thématiques/mois
représentent environ `$0.64` d'overage de dimensions interrogées après l'inclusion de 50M ; 2M
recherches représenteraient environ `$20`. Cette estimation applique la formule officielle et ne
comprend ni Workers ni l'embedding.

Vectorize ajoute toutefois une publication dérivée non transactionnelle : upsert, attente du
mutation ID, validation, puis bascule de génération. Pour 11,5k sujets déjà dans PostgreSQL, ce coût
de cohérence n'est justifié que par un gain de latence ou de charge Neon mesuré.

## Coût et limites Workers AI

Qwen3-Embedding-0.6B et BGE-M3 sont tous deux facturés `$0.012` par million de tokens d'entrée.
Workers AI offre 10 000 neurons/jour, puis facture `$0.011/1 000 neurons` sur Workers Paid. La limite
générale text embeddings est de 3 000 requêtes/minute.

Sources : [tarifs Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/),
[limites Workers AI](https://developers.cloudflare.com/workers-ai/platform/limits/).

Même avec 2M requêtes de 25 tokens dans le mois, le coût d'embedding Qwen/BGE serait d'environ
`$0.60` avant allocation gratuite. L'ingestion unique de 11,5k libellés courts coûte une fraction de
centime. Le coût déterminant sera davantage la base/vector store et l'exploitation que l'inférence.

## Benchmark obligatoire avant choix final

### Pilote local réalisé

Un pilote comparatif a encodé les mêmes 11 518 documents thématiques avec les deux modèles Workers
AI et évalué neuf descriptions françaises implicites contre des familles de topics acceptables.
Qwen v2 obtient 9/9 premiers thèmes pertinents ; BGE-M3 obtient 6/9. BGE échoue notamment en top 1
sur le refus de pardonner, l'envie et la prière sans réponse. Le premier passage BGE avait été
invalidé parce qu'un ancien proxy local restait figé sur Qwen ; les mesures conservées ont vérifié
au préalable que les deux sorties vectorielles divergeaient.

Sur le corpus fonctionnel élargi à 22 requêtes, le moteur hybride trouve une famille pertinente
pour chaque cas après calibration du contrat et du seuil. L'index HNSW exécute la récupération
vectorielle PostgreSQL en environ 2 ms sur la machine locale ; la latence froide restante vient de
l'inférence Workers AI distante, très variable depuis Wrangler local. Ces 22 cas sont un pilote de
non-régression, pas un substitut aux jugements humains ci-dessous.

Étendre les 13 requêtes actuelles à au moins 150 jugements humains :

- requêtes FR naturelles vers topics EN ;
- requêtes EN vers topics EN ;
- alias exacts et fautes mobiles ;
- paraphrases sans vocabulaire partagé ;
- distinctions proches : peur/anxiété, pardon/réconciliation, mort/deuil, foi/confiance,
  jugement/condamnation ;
- formulations religieuses et formulations quotidiennes ;
- négatifs difficiles et requêtes sans thème valable.

Comparer feature-hash, Qwen, BGE-M3 et, si le temps le permet, EmbeddingGemma. Mesurer Recall@5/10,
nDCG@10, MRR, taux de résultat vector-only faux, p50/p95/p99 de l'embedding et de la requête totale,
taille et coût. Conserver le ranking lexical exact au-dessus du vectoriel.

Critère pragmatique : retenir Qwen seulement s'il améliore nettement Recall@10 et nDCG@10 sur le
slice FR→EN sans faire régresser les requêtes exactes. Sinon choisir BGE-M3. EmbeddingGemma devient
préférable uniquement si sa latence ou ses 768 dimensions apportent un avantage matériel à qualité
équivalente. E5 sert de baseline scientifique locale, pas de cible d'exploitation actuelle.

## Plan local, sans déploiement

1. Introduire un contrat `TopicEmbeddingProvider` avec méthodes document/query, modèle, dimension et
   version de prompt ; garder le feature-hash comme fake déterministe de test.
2. Ajouter une commande de benchmark locale capable de lire des vecteurs pré-calculés Qwen/BGE,
   sans secret et sans mutation distante.
3. Construire le corpus de jugements FR/EN et produire le rapport comparatif.
4. Préparer une migration `pgvector vector(1024)` et une table/génération parallèle, sans l'appliquer
   en production.
5. Préparer le provider Workers AI derrière une configuration absente par défaut ; aucun fallback
   silencieux vers un autre modèle.
6. Demander une autorisation séparée avant tout appel batch distant, migration Neon ou activation
   de route de production.

Le point essentiel est de versionner **l'espace vectoriel complet**, pas seulement un nom de
modèle : fournisseur/runtime, modèle, dimension, format document, instruction query et normalisation.
Ce contrat rendra possible un changement futur de Qwen vers BGE ou EmbeddingGemma sans corrompre le
ranking ni les références bibliques.

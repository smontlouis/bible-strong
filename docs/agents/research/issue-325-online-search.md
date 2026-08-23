# Recherche online de production pour Bible Strong — issue #325

_État de la recherche : 23 août 2026. Sources externes primaires uniquement._

## Conclusion

La meilleure architecture pour Bible Strong aujourd'hui n'est pas de remplacer Neon par Algolia,
Typesense, Meilisearch ou Elastic. C'est de construire une **recherche Lakebase Search / PostgreSQL
de production dans le Resource Service existant**, puis d'ajouter un mode sémantique ciblé après
évaluation.

Le choix recommandé est donc :

1. **Cloudflare Worker / Resource Service comme unique API publique** ;
2. **Neon PostgreSQL comme source canonique et premier moteur de recherche** ;
3. `tsvector` par famille linguistique + **`lakebase_text` pour le ranking BM25**, `unaccent`,
   `pg_trgm`, ranking déterministe et une seule requête SQL pour toutes les versions ;
4. **SQLite FTS5 conservé comme moteur offline**, derrière le même contrat de requête ;
5. un mode explicite **« recherche par idée »** en phase 2 : embeddings multilingues calculés par
   Workers AI, passages indexés avec `lakebase_vector`, fusion lexicale-sémantique par RRF, puis
   retour des versets exacts avec leurs références ;
6. **Typesense Cloud comme meilleur challenger dédié** si le prototype PostgreSQL rate les seuils
   convenus de qualité ou de latence. Algolia est le meilleur raccourci vers une UX lexicale très
   polie, mais son coût au volume prévu et son offre sémantique enterprise le rendent peu adapté ici.

Cela confirme le principe déjà inscrit dans
[`docs/online-resources-prd.md`](../../online-resources-prd.md) : mesurer le meilleur PostgreSQL
avant d'introduire un second datastore. L'implémentation actuelle de
[`bibleSearchRepository.ts`](../../../resource-service/src/repositories/bibleSearchRepository.ts)
n'est toutefois pas ce meilleur PostgreSQL : elle fait encore un `ILIKE '%query%'`, classe au
trigramme et surligne par expression régulière. La migration existante ne crée qu'un index
`pg_trgm`.

Le contexte de l'issue [#325](https://github.com/smontlouis/bible-strong/issues/325) est cependant
**partiellement périmé** : le code courant possède déjà un endpoint HTTP multi-version qui exécute
une seule requête SQL globale, et `bibleSearchAccess.ts` propage déjà l'`AbortSignal` de TanStack
Query jusqu'à `fetch` avec timeout. Ces acquis sont à conserver et tester, pas à réimplémenter. Les
écarts actuels sont surtout `ILIKE`/trigram au lieu du vrai full text/BM25, pagination globale par
`offset` plutôt que curseur, filtres canoniques, pagination NEAR offline, pertinence et couverture
de tests.

## Pourquoi PostgreSQL gagne ici

Le corpus de publication local vérifié contient **47 Bibles et 1 374 869 versets** : 20 françaises,
19 anglaises, 4 grecques, 2 hébraïques, 1 hébreu-grec et 1 latine. Ce n'est pas un volume qui impose
à lui seul un cluster de recherche distribué.

PostgreSQL fournit déjà :

- des requêtes simples, expressions exactes, `AND`/`OR`/`NOT`, préfixes et proximité via `tsquery` ;
- `websearch_to_tsquery`, qui accepte du texte utilisateur sans lever d'erreur et comprend les
  guillemets, `OR` et l'exclusion ;
- `ts_rank` et `ts_rank_cd`, qui intègrent fréquence, structure et proximité ;
- `ts_headline` pour générer des extraits ;
- des configurations et dictionnaires linguistiques, dont les stemmers français, anglais et grec ;
- `unaccent`, dictionnaire filtrant qui retire les diacritiques ;
- des index GIN pour le full text et `pg_trgm` pour le fuzzy/substrat de tolérance aux fautes.

Sources officielles PostgreSQL :
[fonctions et opérateurs full text](https://www.postgresql.org/docs/current/functions-textsearch.html),
[contrôle, ranking et highlighting](https://www.postgresql.org/docs/current/textsearch-controls.html),
[dictionnaires](https://www.postgresql.org/docs/current/textsearch-dictionaries.html),
[`unaccent`](https://www.postgresql.org/docs/current/unaccent.html),
[objets linguistiques installés](https://www.postgresql.org/docs/current/textsearch-psql.html).

Neon facture actuellement son plan Launch à l'usage (`$0.106/CU-h`, `$0.35/GB-month`) et inclut
autoscaling, haute disponibilité du stockage, pooling et extensions de recherche. La dépense
incrémentale doit être mesurée sur le projet existant plutôt que comparée à un nouveau cluster sur
la seule base d'un tarif de vitrine. Source : [tarifs Neon](https://neon.com/pricing).

En août 2026, l'extension Neon à retenir est **Lakebase Search**, pas `pg_search` : Neon a déprécié
`pg_search` le 19 mars 2026, bloque son activation sur de nouveaux projets et prévoit sa suppression
en septembre 2026
([avis officiel](https://neon.com/docs/extensions/pg_search)). Son remplaçant `lakebase_text`
fonctionne sur PostgreSQL 16+, construit un index BM25 à partir d'un `tsvector` et pousse le top-K
dans l'index, tout en conservant les configurations linguistiques PostgreSQL
([extension `lakebase_text`](https://neon.com/docs/extensions/lakebase-text)). La pile Lakebase
réunit cette recherche textuelle et `lakebase_vector` pour une fusion hybride
([vue d'ensemble](https://neon.com/docs/ai/lakebase-search),
[guide de démarrage](https://neon.com/docs/ai/lakebase-search-get-started)).

Les limites sont réelles : PostgreSQL ne fournit pas une tolérance aux fautes de niveau Algolia en
un réglage, son analyse de l'hébreu biblique reste à construire, et le tuning de pertinence nous
appartient. Mais Bible Strong possède déjà le texte, ses langues, son canon, ses identités de verset
et son pipeline de publication. Cette connaissance du domaine compte davantage qu'un ranking
e-commerce prêt à l'emploi.

## Architecture recommandée

### 1. Trois intentions, dans cet ordre

Une seule chaîne de recherche ne doit pas essayer de deviner toutes les intentions.

1. **Référence** : parser localement et côté serveur `Jean 3:16`, `Jn 3.16-18`, noms localisés et
   identités Strong `H430`/`G26`. Cette voie est exacte, sans typo sur les nombres ni embedding.
2. **Texte** : mots, préfixes, phrase entre guillemets et opérateurs explicites. C'est la voie par
   défaut et elle interroge le texte réel de chaque traduction.
3. **Idée** : question ou thème comme « versets sur l'anxiété » ou « pardonner à son ennemi ». Ce
   mode hybride doit d'abord être un choix visible de l'utilisateur. Un déclenchement automatique
   ne devrait arriver qu'après mesure des faux positifs.

La recherche exacte doit toujours gagner sur le fuzzy et sur le sémantique. Une requête entre
guillemets, une référence ou un identifiant Strong ne doit jamais être élargie silencieusement.

### 2. Index lexical Lakebase / PostgreSQL

Chaque verset publié garde le texte original immuable et reçoit des champs dérivés, reproductibles
par le pipeline :

- `search_text_folded` : casse, apostrophes et espaces normalisés ; diacritiques retirés dans une
  voie secondaire, jamais dans le texte affiché ;
- `search_vector` : `tsvector` construit avec la configuration de la version ;
- `language`, `version_id`, `publication_id`, `canon_id`, `versification_id`, `book`, `chapter`,
  `verse`, `section` et ordre canonique ;
- éventuellement `strong_ids` et lemmes, mais dans une verticale lexicale dédiée, pas mélangés au
  score du texte biblique.

Configuration proposée :

- français : configuration copiée de `french`, précédée de `unaccent`, avec une petite liste de
  synonymes uniquement validée par le corpus ;
- anglais : même schéma à partir de `english` ;
- grec : comparer `greek` et `simple` sur les formes bibliques ; conserver une voie pliée sans
  accents et normaliser le sigma final dans le champ dérivé ;
- hébreu : `simple` sur le texte Unicode, plus une voie dérivée sans cantillation/niqqud ; ne pas
  prétendre faire de la morphologie sans s'appuyer sur les identités Strong ;
- latin : commencer par `simple` et mesurer avant d'ajouter une analyse linguistique.

Index :

- index `lakebase_text` BM25 sur `search_vector`, avec top-K poussé dans l'index ;
- GIN natif sur `search_vector` conservé au moins durant le prototype comme baseline et voie de
  compatibilité pour les opérateurs non couverts ;
- GIN `gin_trgm_ops` sur `search_text_folded` ;
- B-tree couvrant publication/version/section/livre et identité canonique ;
- `ANALYZE` après activation de publication.

Pipeline de matching proposé :

1. phrase et termes exacts ;
2. FTS avec tous les termes, score BM25 `lakebase_text` ; `ts_rank_cd` sert de baseline mesurée ;
3. préfixes (`:*`) lorsqu'ils font partie du contrat ;
4. seulement si les premiers étages donnent trop peu de résultats, candidats `pg_trgm` avec seuil
   dépendant de la longueur ;
5. tri final stable par étage de match, score quantifié, ordre canonique, ordre de version et
   identité du verset.

Cette cascade évite qu'une faute tolérée dépasse un verset exact. Les seuils ne doivent pas être
choisis à l'intuition : ils sont appris sur le corpus d'évaluation décrit plus bas.

### 3. Une API agrégée et un vrai curseur

Le mobile envoie une seule requête :

```text
POST /v1/search
{
  query, intent, versionIds, resourceTypes,
  canonIds, section, bookIds, sort, pageSize, cursor
}
```

Le serveur cherche toutes les versions éligibles en une seule exécution et renvoie des sections
agrégées. Le curseur opaque encode au minimum : hash de la requête normalisée, génération de
publication, dernier tuple de tri et taille de page. Une publication différente invalide le
curseur proprement. Il ne faut pas exposer un `offset` comme contrat durable : avec un ranking
global et des publications actives, il favorise les doublons et pages instables.

Pour la vue « toutes les versions », deux présentations doivent être testées :

- résultat par `(version, verset)`, fidèle au comportement actuel ;
- résultat regroupé par référence/versification, avec les traductions comme variantes, afin que 47
  rendus de Jean 3:16 ne chassent pas toutes les autres références de la première page.

Le contrat de réponse contient le texte original et des **plages Unicode de surlignage**, pas du
HTML fourni par un moteur. L'identité est explicite : version, révision, versification, livre,
chapitre, verset ou plage. Le score brut reste interne ; l'API peut exposer un `matchKind`
(`exact`, `phrase`, `terms`, `prefix`, `typo`, `semantic`) stable.

Les recherches éditoriales (Bible, Strong, Nave, dictionnaire, commentaires) peuvent être
fédérées côté Resource Service, mais restent des verticales classées séparément. Les notes, liens
et études de l'utilisateur demeurent dans la recherche locale privée et sont fusionnés dans le
modèle d'écran : elles ne doivent pas entrer dans l'index public.

### 4. Mobile, offline et sécurité

- TanStack Query transmet son `AbortSignal` jusqu'à `fetch` ; une requête remplacée est annulée.
  C'est déjà implémenté dans `bibleSearchAccess.ts` et doit être protégé par un test.
- Online est préféré lorsque la connectivité est réelle ; timeout, `429`, `502`/`503` et panne
  réseau déclenchent le fallback SQLite si une version éligible est installée.
- Une erreur d'intégrité, de contrat ou de révision reste visible et ne se transforme pas en
  « aucun résultat ».
- L'offline implémente le même AST de requête, les mêmes filtres, identités et types de match ; il
  n'a pas à reproduire les scores PostgreSQL.
- Le Worker conserve App Check, rate limiting et quotas par classe de requête. Aucun secret Neon,
  moteur ou fournisseur biblique ne réside dans Expo.
- Le texte exact des recherches, qui révèle potentiellement des sujets spirituels ou personnels,
  n'est ni loggé ni envoyé à l'analytics. Les métriques gardent langue, mode, latence, taille de
  page, classe d'erreur et buckets de nombre de résultats.

Même les moteurs qui disent qu'une clé `search-only` est utilisable dans un frontend préviennent
qu'elle permet le scraping et le flooding. Algolia le documente explicitement
([API keys](https://www.algolia.com/doc/guides/security/api-keys?language=javascript)) ; Typesense
recommande en outre de ne pas figer clé et hostname dans une app native, afin de pouvoir les faire
tourner sans attendre une release
([access control](https://typesense.org/docs/guide/data-access-control.html)). Le proxy Worker reste
donc le bon périmètre même si un moteur dédié est ajouté.

## Recherche sémantique : utile, mais bornée

La valeur sémantique existe pour la **découverte thématique**, pas pour retrouver un texte ou
garantir une concordance. Elle ne doit produire ni commentaire génératif ni citation inventée.

Architecture phase 2 :

1. créer un corpus de passages de 3 à 7 versets ou de péricopes, chacun mappé à une plage de
   références exacte ;
2. utiliser une traduction d'ancrage FR et une EN dont les droits autorisent explicitement
   l'indexation vectorielle, plutôt que vectoriser 47 traductions ;
3. calculer les embeddings à la publication avec Workers AI `@cf/baai/bge-m3`, présenté comme
   multilingue ; stocker modèle, version, hash du texte et vecteur dans Neon `lakebase_vector` ;
4. à la requête, obtenir les meilleurs candidats lexicaux et vectoriels filtrés par canon/livre,
   les fusionner par Reciprocal Rank Fusion (RRF), puis hydrater les versets exacts dans les
   versions demandées ;
5. rendre la référence et le texte canonique, jamais une réponse générée ; afficher le type
   « par idée ».

La documentation Lakebase Search associe `lakebase_text` et `lakebase_vector` par fusion RRF
([vue d'ensemble](https://neon.com/docs/ai/lakebase-search),
[guide](https://neon.com/docs/ai/lakebase-search-get-started)). Workers AI propose actuellement
BGE-M3 à `$0.012` par million de tokens d'entrée
([modèle](https://developers.cloudflare.com/workers-ai/models/bge-m3/),
[tarifs](https://developers.cloudflare.com/workers-ai/platform/pricing/)). Cloudflare indique ne
pas utiliser le contenu client Workers AI pour entraîner ses modèles ou améliorer ses services,
sans consentement explicite
([data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/)). Cela ne dispense
ni de l'examen contractuel des traductions, ni de supprimer les logs de requêtes.

`lakebase_vector` est préférable à Vectorize au départ : le corpus est petit, les filtres et
jointures de publication restent dans Neon, et aucun troisième datastore ne doit être synchronisé.
Si la latence vectorielle manque la cible, Vectorize est le challenger naturel dans la pile Cloudflare ;
il filtre les métadonnées avant le top-K mais limite un index à dix propriétés de métadonnées
indexées
([documentation officielle](https://developers.cloudflare.com/vectorize/reference/metadata-filtering/)).

## Comparaison des moteurs hébergés

| Option | Forces pour Bible Strong | Faiblesses / coût / ops | Verdict |
|---|---|---|---|
| **Neon Lakebase Search / PostgreSQL** | Même source de vérité ; BM25 sur `tsvector`, top-K indexé, filtres, phrases, proximité, global multi-version, `pg_trgm`, vectoriel et RRF ; publication transactionnelle | Typo et pertinence à construire ; linguistique hébraïque limitée ; extension récente à valider sous charge | **Choix recommandé maintenant** |
| **Typesense Cloud** | Très bonne typo mobile, préfixes, facettes, highlights, filtres, multi-search, vectoriel et hybride ; cluster dédié sans facturation par requête/document | Nouveau datastore dérivé ; HA et réseau augmentent le prix ; clés/host à faire tourner ; pertinence biblique à évaluer | **Meilleur challenger dédié** |
| **Meilisearch Cloud** | UX instant search simple, typo activée, facettes, highlighting et hybride ; Cloud à partir de `$20/mo` | Nouveau datastore ; contrôle de ranking/pagination à valider ; dimensionnement réel inconnu avant import et charge | Bon prototype économique, derrière Typesense pour ce besoin |
| **Algolia** | Meilleure mise en route turnkey ; excellente typo FR/EN, ranking, facettes, highlighting, analytics et présence EU | Facturation requêtes + records ; NeuralSearch en offre Elevate annuelle ; contenu facilement scrapable avec clé frontend | Excellent produit, mauvais rapport coût/contrôle ici |
| **Elastic Cloud / OpenSearch** | DSL, analyseurs, agrégations, fuzzy, highlights, RRF/hybride et observabilité les plus profonds | Complexité, coût plancher et surface opérationnelle disproportionnés pour 1 374 869 versets | À exclure sauf mutualisation future à grande échelle |

### Typesense

Typesense expose typo, split/join de tokens, facettes, filtres, snippets/highlights et limite de hits
dans la même API ; il sait aussi fusionner keyword et vector search par rank fusion. Sources :
[Search API](https://typesense.org/docs/30.0/api/search.html),
[Vector / Hybrid Search](https://typesense.org/docs/28.0/api/vector-search.html). Typesense Cloud
facture un cluster dédié à l'heure, la bande passante et éventuellement le support, même sans
trafic ; la haute disponibilité est à activer séparément
([billing](https://cloud-help.typesense.org/article/billing-process),
[calculateur](https://cloud.typesense.org/pricing/calculator)).

### Meilisearch

La tolérance aux fautes est activée par défaut et configurable, y compris désactivation sur les
nombres et mots sensibles. Les attributs doivent être déclarés filtrables pour les filtres et
facettes ; la recherche hybride est disponible dans l'API. Sources :
[typo tolerance](https://www.meilisearch.com/docs/capabilities/full_text_search/relevancy/typo_tolerance_settings),
[filtering/faceting](https://www.meilisearch.com/docs/capabilities/filtering_sorting_faceting/overview),
[Search API et hybrid](https://www.meilisearch.com/docs/reference/api/search/search-with-post).
Meilisearch Cloud commence à `$20/mo` et propose facturation à l'usage ou par ressources
([pricing](https://www.meilisearch.com/pricing)).

### Algolia

Algolia est le plus abouti pour une expérience « search as you type ». La typo est activée par
défaut, configurable et conçue pour les langues phonémiques dont le français et l'anglais ; ses API
couvrent filtres, facettes, highlighting et recherche multi-index. Sources :
[typo tolerance](https://www.algolia.com/doc/guides/managing-results/optimize-search-results/typo-tolerance),
[langues](https://www.algolia.com/doc/guides/managing-results/optimize-search-results/handling-natural-languages-nlp),
[Search API](https://www.algolia.com/doc/rest-api/search).

Au budget de conception du projet — 2 millions d'actions de recherche mensuelles — et avec
1 374 869 records-versets, le tarif Grow public donne un ordre de grandeur de **$1 505/mois** avant
l'AI : 10 000 requêtes incluses puis `$0.50/1k`, 100 000 records inclus puis `$0.40/1k`. Les copies
d'index pour des tris alternatifs comptent comme records. NeuralSearch est
réservé à Elevate, sur contrat annuel sans prix public. Source et définition des unités :
[pricing Algolia](https://www.algolia.com/pricing). Cette estimation est indicative : les records
réels, les accords de volume et le nombre de requêtes facturées doivent être mesurés.

### Elastic / OpenSearch

Elastic offre fuzzy, phrase/proximité, agrégations, highlighting et une recherche hybride RRF avec
champ sémantique. Sources :
[full-text queries](https://www.elastic.co/docs/reference/query-languages/query-dsl/full-text-queries),
[highlighting](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/highlighting),
[semantic search](https://www.elastic.co/docs/solutions/search/get-started/semantic-search).
Elastic Serverless facture séparément ingest (dès `$0.14/VCU-h`), search (`$0.09/VCU-h`), ML,
stockage et egress
([pricing](https://www.elastic.co/pricing/serverless-search/)). Amazon OpenSearch facture clusters
ou OCU serverless et stockage
([pricing officiel](https://aws.amazon.com/opensearch-service/pricing/)). Les deux ne deviennent
pertinents que si l'organisation veut mutualiser beaucoup d'autres corpus, équipes et besoins
d'analyse.

## API bibliques : complément de licence, pas moteur principal

### API.Bible

API.Bible est le seul candidat sérieux pour acquérir rapidement l'accès à des traductions que Bible
Strong ne peut pas héberger. Son endpoint cherche **une Bible à la fois**, avec tous les mots,
wildcards, fuzziness, offset/limit et tri pertinence/canonique
([Search API](https://docs.api.bible/guides/search/)). Il recommande de ne pas mettre la clé dans un
client React.

Ce n'est pas un meilleur socle pour #325 : pas de ranking global multi-version, fan-out obligatoire,
contrat de recherche moins riche, dépendance réseau sans offline garanti et quotas trop petits pour
le budget de 2 M recherches/mois hors Enterprise. Le plan Starter est non commercial, 5 000 appels
par mois ; Pro commence à `$29/mo`, 150 000 appels et facture les Bibles sous copyright en plus
([plans actuels](https://docs.api.bible/quick-start/create-your-account/)). API.Bible exige aussi
l'affichage des copyrights et interdit la sous-licence ; cache et modes de distribution dépendent
des droits de chaque traduction
([FAQ officielle](https://docs.api.bible/common-questions/)).

API.Bible reste utile comme **canal d'acquisition/licence ou source distante pour une version
particulière**, derrière le Worker, si son contrat autorise précisément l'usage voulu. Il ne doit pas
remplacer l'index propriétaire du corpus déjà distribuable.

### YouVersion Platform et autres API

YouVersion annonce un accès officiel à plus de mille versions et des SDK React/React Native
([overview](https://developers.youversion.com/overview)), mais l'accès dépend d'une App Key, des
permissions et de l'accord de licence propre à chaque Bible
([license API](https://developers.youversion.com/api/licenses)). Son API peut élargir le catalogue ;
elle ne dispense pas Bible Strong de son propre contrat de recherche, de l'offline, du ranking
global ni de la vérification des droits d'indexation.

Bible Gateway publie un endpoint keyword avec modes `all`, `phrase`, `any`, limites par livres et
pagination
([documentation](https://www.biblegateway.com/api/documentation)), mais il ne présente pas une
offre moderne clairement dimensionnée pour devenir la dépendance de production de cette app.

## Licences et indexation

Le texte canonique, l'index lexical et les embeddings sont trois modes de traitement à autoriser
explicitement. Pour chaque version, le manifeste de publication doit stocker : provenance,
titulaire, URL/identifiant des termes, attribution, date de revue et capacités séparées :

- `onlineDisplay` ;
- `offlineDistribution` ;
- `lexicalIndexing` ;
- `embeddingGeneration` ;
- `thirdPartySearchHosting` ;
- `queryProviderOnly`.

Une licence qui permet l'affichage par API n'autorise pas automatiquement la copie intégrale dans
Algolia, Typesense, Meilisearch ou un modèle vectoriel. À titre d'exemple, la politique Biblica de
juin 2026 permet certains usages AI/ML **sous réserve du contrat de licence**, exige un hébergement
sécurisé, interdit l'exposition des matériaux et encadre fortement modèles et résultats
([politique officielle](https://www.biblica.com/publisher-ai-policy/)). Cela confirme qu'un drapeau
générique `copyright` est insuffisant.

Le pipeline doit refuser une publication ou un index dérivé si la capacité correspondante manque.
Une traduction publique ou sous licence compatible sert d'ancrage sémantique ; les autres peuvent
rester lexicales ou être interrogées uniquement chez leur fournisseur.

## Corpus d'évaluation et critères de sortie

Avant tout changement de moteur, construire 200 à 400 requêtes revues humainement, avec jugements
par intention et résultats attendus :

- FR/EN : exact, accent omis, apostrophe, flexions, mot incomplet, une et deux fautes mobiles ;
- phrases, `AND`/`OR`/`NOT`, proximité, mots très fréquents et zéro résultat ;
- hébreu pointé/non pointé, cantillation, grec accentué/non accentué et sigma final ;
- références localisées, plages, deutérocanoniques, filtres AT/NT/canon/livre ;
- `H####`/`G####`, lemme et translittération ;
- recherche une version et toutes les versions ;
- questions thématiques où le lexical échoue, plus contre-exemples sémantiques théologiquement
  proches mais textuellement non pertinents.

Mesures proposées :

| Dimension | Seuil initial proposé |
|---|---:|
| Référence/identité Strong exacte | 100 % sur les fixtures |
| Phrase exacte et filtres de canon | 100 % de correction fonctionnelle |
| Pages globales | aucun doublon/trou, ordre reproductible pour une génération |
| Qualité lexicale | nDCG@10 et MRR supérieurs au baseline SQLite sur le panel online |
| Sémantique | gain significatif de Recall@20 sur les requêtes « idée », sans régression des requêtes exactes |
| Backend | p95 < 250 ms, p99 < 600 ms au pic cible |
| Mobile online | p95 < 700 ms hors temps de saisie/debounce |
| Résilience | fallback local uniquement sur erreurs transitoires, requêtes remplacées annulées |

Ces seuils sont des objectifs de produit proposés, pas des promesses des fournisseurs. Tester sur
le dataset de publication complet, avec requêtes froides/chaudes, une version/toutes versions,
filtres et pic d'au moins 50 requêtes/s. Rapporter p50/p95/p99, CPU/CU, lignes lues, taille des index,
coût projeté à 2 M recherches/mois et qualité par langue.

Le challenger Typesense n'est retenu que s'il apporte un gain humainement visible et reproductible
que Lakebase/PostgreSQL ne peut atteindre dans le budget, ou si celui-ci manque les cibles de
latence/coût après index et plans de requête corrects. Dans ce cas, Neon reste la source de vérité :
publication blue/green vers une collection dérivée, validation de compte/hash, swap d'alias, puis
suppression différée de l'ancien index.

## Tracer path recommandé

1. Écrire l'AST/contrat partagé et le corpus de jugement ; corriger filtres canoniques et pagination
   NEAR offline ; ajouter les tests qui figent l'annulation déjà fonctionnelle.
2. Conserver l'endpoint multi-version et sa requête SQL globale ; remplacer le `ILIKE` par
   `lakebase_text` + trigram et le ranking en étages, puis faire évoluer son `offset` vers un curseur
   opaque déterministe.
3. Mesurer sur toutes les publications et faire une revue humaine FR/EN/hébreu/grec.
4. Si les seuils sont ratés, importer le même corpus dans Typesense Cloud et exécuter exactement le
   même harness.
5. Prototyper séparément « recherche par idée » sur un corpus d'ancrage public/licencié,
   Workers AI BGE-M3 + `lakebase_vector` + RRF.
6. Décider par ADR avec qualité, p95/p99, coût mensuel projeté, droits, ops et plan de rollback.

La décision importante est donc moins « quel SaaS est le meilleur ? » que « quelle sémantique
Bible Strong garantit-elle ? ». Une fois ce contrat et son corpus de mesure en place, **Lakebase
Search sur le PostgreSQL Neon existant** est le meilleur moteur online actuel pour l'app ; Typesense
est le test comparatif à garder prêt, et le sémantique doit rester une capacité de découverte
précisément bornée.

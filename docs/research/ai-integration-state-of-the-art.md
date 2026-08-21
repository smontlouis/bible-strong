# Intégration IA dans Bible Strong : état de l'art et architecture recommandée

_Recherche effectuée le 21 août 2026. Les capacités, tarifs et politiques des fournisseurs évoluent rapidement ; les éléments datés doivent être revérifiés avant contractualisation ou mise en production._

## Résumé exécutif

La bonne architecture n'est **ni un gros prompt système**, ni **un RAG branché directement sur toute la base PostgreSQL**, ni **un chatbot généraliste auquel on demande d'être chrétien**.

Pour Bible Strong, l'option la plus robuste est un **assistant de recherche biblique fondé sur des sources**, composé de plusieurs étapes explicites :

1. déterminer le type de demande et son contexte biblique ;
2. appeler des outils de lecture bornés et typés sur les ressources Bible Strong ;
3. effectuer, quand nécessaire, une recherche hybride lexicale + sémantique ;
4. reranker et filtrer les résultats par langue, type de ressource, droits et perspective théologique ;
5. générer une réponse structurée dont chaque affirmation vérifiable renvoie à une source ouvrable ;
6. valider les références, citations, limites et signaux de risque avant affichage ;
7. s'abstenir lorsque les sources sont insuffisantes ou contradictoires.

Le RAG est donc une **brique importante**, surtout pour la recherche et le chat, mais pas une garantie de vérité. Les écrans déjà ancrés sur une entité — chapitre, passage, numéro Strong, entrée de dictionnaire — doivent commencer par un accès exact et déterministe à cette entité ; la recherche sémantique ne vient qu'en enrichissement. Un long contexte est utile pour synthétiser un petit dossier déjà sélectionné, pas pour envoyer toute la bibliothèque au modèle.

Le premier produit à livrer ne devrait pas être un « pasteur IA ». Il devrait être un **assistant de lecture vérifiable** : résumés de chapitres, contexte historique/littéraire, explication Strong, recherche biblique en langage naturel et synthèse de sources. Le chat ouvert, les données personnelles (notes/tags) et les conseils spirituels personnalisés doivent venir plus tard, après la mise en place d'évaluations éditoriales et de garde-fous éprouvés.

## Comment lire cette note

- **Fait sourcé** : affirmation directement étayée par une source primaire ou une publication originale.
- **Inférence** : conséquence raisonnable tirée des sources et du contexte de Bible Strong, mais non affirmée telle quelle par la source.
- **Recommandation** : choix proposé pour Bible Strong ; il reste à valider par le produit, l'éditorial, le juridique et des essais mesurés.

## 1. Ce que l'état de l'art permet — et ne permet pas

### 1.1 Le RAG réduit le problème de connaissance sans le supprimer

**Faits sourcés.** Le RAG combine un modèle génératif avec une mémoire externe récupérée au moment de la requête ; le travail fondateur de Lewis et al. a montré son intérêt pour des tâches intensives en connaissances ([NeurIPS 2020](https://papers.neurips.cc/paper_files/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html)). Il permet de mettre à jour le corpus sans réentraîner le modèle et de montrer les passages utilisés. Cependant, des corpus de recherche consacrés au RAG contiennent encore des hallucinations : RAGTruth a précisément été créé pour les détecter ([ACL 2024](https://aclanthology.org/2024.acl-long.585/)). Les modèles instructionnels peuvent aussi produire une réponse correcte mais non fidèle aux passages fournis, ou fidèle mais incomplète ([TACL 2024](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00667/121196/Evaluating-Correctness-and-Faithfulness-of)).

**Inférence.** Donner une Bible et des commentaires à un modèle n'implique pas qu'il citera bien, qu'il distinguera le texte biblique du commentaire ou qu'il refusera une conclusion non soutenue. La qualité finale dépend au moins de l'ingestion, du découpage, de la récupération, du classement, de la génération et de la validation.

**Recommandation.** Employer le terme « RAG vérifiable » pour le système cible : toute affirmation historique, lexicale ou doctrinale doit être traçable vers un extrait précis et ouvrable. Une réponse sans preuve suffisante doit devenir « les ressources consultées ne permettent pas de répondre avec assez de confiance », et non une complétion depuis la mémoire paramétrique du modèle.

### 1.2 Long contexte et RAG sont complémentaires

**Faits sourcés.** Les modèles à long contexte ne consomment pas uniformément toute l'information : l'étude _Lost in the Middle_ observe une dégradation lorsque l'information pertinente se trouve au milieu d'un grand contexte et suggère notamment le reranking et la troncature des documents ([TACL 2024](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00638/119630/Lost-in-the-Middle-How-Language-Models-Use-Long)). Une comparaison RAG/long contexte sur plusieurs tâches trouve que le long contexte peut être meilleur lorsque les ressources sont suffisantes, tandis que le RAG coûte nettement moins cher ; une approche de routage hybride maintient une performance proche du long contexte avec moins de calcul ([EMNLP 2024](https://aclanthology.org/2024.emnlp-industry.66/)).

**Recommandation.** Utiliser trois chemins :

- **contexte direct** pour un chapitre, un passage ou une entrée Strong déjà identifiés ;
- **RAG** pour une question ouverte ou une recherche transversale ;
- **long contexte borné** seulement après récupération/reranking, lorsque plusieurs sources complètes doivent être comparées ou synthétisées.

Ne pas envoyer une bibliothèque entière « parce que le modèle accepte beaucoup de tokens ». Cela augmente coût, latence, surface de fuite et bruit sans garantir que le modèle utilisera correctement les éléments centraux.

### 1.3 Un prompt système est nécessaire, mais ce n'est ni une base de connaissances ni une barrière de sécurité

**Faits sourcés.** Google précise que les instructions système aident à guider un modèle mais n'empêchent pas complètement les jailbreaks ou les fuites, et déconseille d'y mettre des informations sensibles ([Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/system-instruction-introduction)). OWASP dit plus directement qu'un prompt système ne doit pas être considéré comme secret ni comme contrôle de sécurité ; permissions, secrets et contrôles critiques doivent vivre hors du LLM ([OWASP LLM07:2025](https://genai.owasp.org/llmrisk/llm072025-system-prompt-leakage/)). Les travaux d'OpenAI sur la hiérarchie des instructions montrent que l'entraînement peut améliorer la résistance, mais décrivent toujours la prompt injection comme une vulnérabilité à traiter ([OpenAI, 2024](https://openai.com/index/the-instruction-hierarchy/)).

**Recommandation.** Garder un prompt système court, versionné et testable, contenant : rôle, limites, hiérarchie des sources, règles d'abstention, traitement des désaccords, ton, interdictions pastorales et contrat de sortie. Ne jamais y mettre de secret, de chaîne de connexion, de règle d'autorisation, ni une théologie entière. Supposer que son contenu sera un jour inféré ou extrait.

### 1.4 Le fine-tuning n'est pas le premier outil pour « apprendre » la bibliothèque

**Faits sourcés.** OpenAI décrit l'optimisation comme une boucle qui commence par des évaluations, puis fournit contexte et instructions, et n'envisage le fine-tuning que pour certains usages ; le même guide rappelle que les sorties sont non déterministes et que le comportement change entre familles et snapshots ([Model optimization](https://developers.openai.com/api/docs/guides/model-optimization)).

**Recommandation.** Ne pas fine-tuner en première version. Le contenu éditorial doit rester dans un corpus versionné et récupérable. Envisager plus tard un fine-tuning pour un comportement étroit et mesurable — classement d'intention, style, format d'abstention — uniquement si le prompt + les exemples + les sorties structurées ne suffisent pas et si un jeu d'évaluation prouve le gain.

## 2. Architecture cible pour Bible Strong

### 2.1 Vue d'ensemble

```text
App mobile
  |
  | contexte explicite : passage, version, Strong, langue, mode
  v
Cloudflare Worker / AI Gateway Bible Strong
  |- authentification optionnelle, App Check, quotas, rate limiting
  |- modération / détection de hors-sujet / budget
  |- routeur déterministe ou petit modèle structuré
  |
  +--> outils exacts en lecture seule (Resource domain API)
  |      passage | Strong | dictionnaire | cross-références | droits
  |
  +--> recherche Neon
  |      FTS PostgreSQL + pgvector -> fusion RRF -> reranker
  |
  +--> assembleur de contexte
  |      extraits bornés + métadonnées + identifiants de citation
  |
  +--> modèle génératif (fournisseur remplaçable)
  |      sortie JSON stricte
  |
  +--> validateurs hors LLM
         schéma | références | citations | droits | longueur | sécurité
  |
  v
UI : réponse IA explicitement marquée + sources ouvrables + signalement
```

Cette architecture prolonge la décision déjà prise dans [ADR-0009](../adr/0009-host-resource-delivery-on-neon-and-cloudflare.md) : Neon comme base canonique, Worker comme frontière d'API et d'abuse controls, et absence de secrets de base dans le client. Elle respecte aussi l'invariant actuel d'observabilité : ne pas journaliser le texte exact des recherches ni les contenus rédigés par les utilisateurs.

**Périmètre MVP.** Cette proposition suppose une IA entièrement en ligne : aucune inférence ni index vectoriel IA sur le mobile. Sans connexion, la surface IA est indisponible et l'application conserve ses fonctions de lecture/recherche classiques. L'on-device ne figure que comme option future de confidentialité ou de coût pour des tâches étroites.

### 2.2 Ne pas connecter le modèle directement à PostgreSQL

**Recommandation.** Le modèle ne reçoit jamais une connexion SQL et ne génère jamais une requête SQL libre exécutée sur Neon. Il ne connaît que quelques outils serveur typés, en lecture seule, par exemple :

- `get_passage(version, start, end, locale)` ;
- `get_strong_entry(strong_id, locale, passage_context?)` ;
- `get_dictionary_entry(dictionary_id, entry_id, locale)` ;
- `search_resources(query, filters, limit)` ;
- `get_source_excerpt(source_id, span_id)` ;
- `list_interpretive_views(topic_id, tradition_filter?)`.

Le serveur valide tous les arguments, applique les droits, limite les lignes et la longueur, puis retourne des DTO canoniques. Les sorties de fonction strictes sont adaptées à ce contrat : le function calling avec mode strict contraint les arguments au schéma déclaré ([documentation OpenAI](https://developers.openai.com/api/docs/guides/function-calling)). Mais la conformité de forme n'est pas une autorisation : les contrôles d'accès restent du code serveur.

**Bénéfice.** Une prompt injection ne peut alors pas demander « exporte toutes les Bibles » ou « lis les notes d'un autre utilisateur » si aucun outil ne possède cette capacité. C'est la réduction de pouvoir, et non le secret du prompt, qui limite l'impact.

### 2.3 Corpus et provenance

Chaque unité indexée devrait conserver au minimum :

- `resource_id`, `resource_revision` et identifiant de segment stable ;
- type : Bible, lexique Strong, dictionnaire, commentaire, cross-référence, article historique, etc. ;
- langue, canon, versification, passage ou entité concernée ;
- auteur/éditeur, date, tradition ou position éditoriale quand elle est connue ;
- statut de confiance : texte primaire, donnée lexicale, source éditoriale relue, source externe ;
- droits : affichage, longueur de citation, recherche sémantique, envoi à un sous-traitant IA, génération dérivée ;
- texte, titre et contexte parent ;
- checksum et date de publication.

**Recommandation.** Ne pas découper uniformément tous les contenus tous les N tokens. Utiliser des unités de domaine : péricope et plage de versets pour le biblique ; sens lexical, morphologie et exemples pour Strong ; section pour un dictionnaire/commentaire. Conserver un lien parent-enfant pour récupérer un petit segment puis élargir au contexte immédiat. Ne jamais perdre l'attribution en fabriquant le texte d'embedding.

Les droits doivent être filtrés **avant** récupération et envoi au fournisseur. La politique IA de Biblica illustre le niveau de contrôle qu'un ayant droit peut exiger : citations limitées, attribution, impossibilité de reconstruire le texte, protection contre l'extraction, supervision humaine et interdiction de présenter l'IA comme Dieu, pasteur ou conseiller spirituel ([Biblica Publisher AI Policy, version 1.2, 2026](https://www.biblica.com/publisher-ai-policy/)). Cette politique ne s'applique que si Bible Strong utilise les contenus concernés sous cette licence, mais elle constitue un signal concret : « posséder une traduction dans PostgreSQL » ne suffit pas à autoriser son embedding ou son transfert à un modèle tiers.

### 2.4 Recherche moderne : exacte, lexicale, sémantique, puis reranking

**Faits sourcés.** La recherche dense retrouve des passages sémantiquement proches même sans mots communs. La recherche hybride ajoute la précision des termes exacts ; la documentation de retrieval d'OpenAI permet de pondérer recherche sémantique et textuelle dans une fusion RRF et d'imposer un seuil de score ([Retrieval API](https://developers.openai.com/api/docs/guides/retrieval)). `pgvector` recommande son association avec la recherche plein texte PostgreSQL, puis RRF ou cross-encoder pour combiner les résultats ([dépôt officiel pgvector](https://github.com/pgvector/pgvector)). Le benchmark BEIR observe que BM25 reste une base robuste et que reranking/late interaction obtiennent en moyenne les meilleurs résultats zero-shot, au prix d'un calcul supérieur ([BEIR, 2021](https://arxiv.org/abs/2104.08663)).

**Recommandation.** Pipeline initial :

1. résolution exacte des références (`Jean 3:16`, `G3056`, titre d'entrée) ;
2. extraction structurée de l'intention et des filtres ;
3. candidats PostgreSQL FTS/BM25-like + candidats pgvector en parallèle ;
4. fusion RRF, qui évite de calibrer immédiatement deux échelles incompatibles ;
5. boosts déterministes (passage ouvert, langue, ressource choisie, proximité d'entité) ;
6. reranking des 20–50 meilleurs candidats vers 5–10 extraits ;
7. seuil minimum ; en dessous, recherche sans synthèse ou demande de précision.

Construire un jeu de requêtes bibliques françaises réelles avant de choisir un modèle d'embedding ou un reranker : noms propres, translittérations grecques/hébraïques, variantes orthographiques, références abrégées et vocabulaire théologique rendent les benchmarks génériques insuffisants.

### 2.5 Sorties structurées et citations vérifiables

**Faits sourcés.** Les Structured Outputs peuvent forcer une réponse à respecter un JSON Schema, rendre les refus détectables et empêcher les clés/énumérations invalides ([documentation OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs)). La même documentation avertit néanmoins qu'un modèle peut remplir un schéma en hallucination lorsque l'entrée ne permet pas une réponse valide. Le benchmark ALCE mesure séparément fluidité, exactitude et qualité des citations ; même les meilleurs systèmes étudiés y manquaient encore de support citationnel complet dans une part importante des réponses ([EMNLP 2023](https://aclanthology.org/2023.emnlp-main.398/)).

**Recommandation.** Faire produire un objet de ce type, jamais du Markdown libre directement rendu :

```json
{
  "answer_status": "answered | insufficient_sources | contested | refused",
  "summary": "…",
  "claims": [
    {
      "text": "…",
      "kind": "textual | historical | lexical | interpretive | application",
      "source_span_ids": ["…"],
      "confidence": "high | medium | low"
    }
  ],
  "perspectives": [
    { "label": "…", "summary": "…", "source_span_ids": ["…"] }
  ],
  "suggested_passages": ["…"],
  "safety_notice": null
}
```

Puis valider hors modèle : tous les identifiants existent dans le contexte fourni ; chaque référence biblique correspond à un livre/chapitre/verset réel dans la versification ; les citations contiennent effectivement un support plausible ; les longueurs et licences sont respectées. L'interface ouvre le passage exact et montre la source, pas une note de bas de page décorative.

## 3. Déclinaison par fonctionnalité

| Surface | Récupération | Génération | Garde-fou central | Priorité |
|---|---|---|---|---|
| Chapitre/passage | passage exact + péricope + ressources ancrées | résumé, structure, contexte littéraire/historique, questions d'observation | distinguer explicitement texte, contexte et interprétation | 1 |
| Strong | entrée exacte + morphologie + occurrences dans leur contexte | synthèse du ou des sens pertinents au passage ouvert | ne pas importer automatiquement tous les sens dans chaque occurrence | 1 |
| Dictionnaire/commentaire | entrée exacte + sections voisines + sources liées | explication et comparaison | conserver auteur/source/tradition ; pas de synthèse sans attribution | 1 |
| Recherche biblique IA | exact + lexical + dense + reranking | réponse brève et liste de passages | afficher les résultats même si la synthèse s'abstient | 1 |
| Suggestions de tags | tags existants + objet explicitement sélectionné | suggestions structurées | aucune écriture automatique ; données personnelles sur opt-in | 2 |
| Chat/méditation | outils précédents + contexte conversationnel limité | dialogue avec citations et questions de réflexion | pas de persona divine/pastorale, gestion des crises, mémoire minimale | 3 |

### 3.1 Chapitre et passage

Le passage est déjà connu : aucun embedding n'est nécessaire pour récupérer le texte. Le serveur ajoute seulement les ressources éditoriales explicitement ancrées, cross-références et éléments de contexte pertinents. Le produit peut proposer des cartes séparées : « En bref », « Structure », « Contexte historique », « Mots clés », « Interprétations ». Cette séparation est plus honnête qu'un texte continu qui mélange les niveaux épistémiques.

Pour un résumé stable et très consulté, préférer une génération éditoriale par batch serveur, relue et versionnée, puis la distribuer comme ressource. Garder la génération à la demande pour les questions personnalisées. Cela réduit coût, variance et risque.

### 3.2 Strong

La première source de vérité reste l'entrée lexicale structurée et le contexte réel depuis lequel l'utilisateur a ouvert le Strong. L'IA explique ; elle ne reconstruit pas l'étymologie depuis ses poids. Le contrat doit distinguer : lemme, translittération, morphologie, sens attestés, glosses, occurrences et interprétation contextuelle. Une « signification profonde cachée » ou une racine incertaine ne doit pas être présentée comme un fait.

### 3.3 Recherche biblique IA

La meilleure analogie n'est pas seulement le résumé IA de Google, mais un moteur à deux couches : résultats ouvrables d'abord, synthèse sourcée ensuite. Exemple : « passages où Jésus parle du pardon après une faute répétée » doit trouver formulations exactes et équivalents sémantiques, puis expliquer pourquoi les passages ont été retenus. Le moteur ne doit pas masquer une récupération médiocre sous une réponse éloquente.

### 3.4 Tags et données utilisateur

Les notes, études, tags et échanges spirituels peuvent révéler des convictions religieuses, donc potentiellement des données sensibles. La CNIL rappelle que la minimisation doit être particulièrement rigoureuse pour les opinions religieuses et recommande une AIPD lorsque plusieurs facteurs de risque sont réunis ([recommandations IA/RGPD](https://www.cnil.fr/fr/developpement-des-systemes-dia-les-recommandations-de-la-cnil-pour-respecter-le-rgpd)). Pour les chatbots libres, elle conseille aussi d'avertir de ne pas communiquer de données sensibles et de prévoir une purge immédiate ou régulière lorsque leur conservation n'est pas pertinente ([conseils chatbots](https://www.cnil.fr/fr/chatbots-les-conseils-de-la-cnil-pour-respecter-les-droits-des-personnes)).

**Recommandation.** Les suggestions de tags sont une action de lecture privée et de modification potentielle :

- opt-in explicite avant l'envoi du texte d'une note/étude à un fournisseur ;
- envoyer seulement l'objet sélectionné et les noms de tags nécessaires, pas tout le compte ;
- afficher les propositions sans les appliquer ;
- confirmation utilisateur pour chaque création/fusion ;
- pour le MVP en ligne, utiliser la même passerelle avec minimisation stricte ; n'étudier un petit modèle on-device qu'ultérieurement, si la confidentialité, le coût et la qualité mesurée le justifient.

### 3.5 Chat et méditation

Le chat doit rester un mode d'étude, pas une présence spirituelle simulée. Il peut poser des questions d'observation, proposer des passages, comparer des sources et aider à formuler une réflexion. Il ne doit pas déclarer la volonté de Dieu pour une personne, prophétiser, absoudre, diagnostiquer, remplacer une communauté/pasteur/professionnel ou exploiter un attachement émotionnel.

La mémoire doit être désactivée par défaut ou très courte. Si un historique synchronisé est proposé, il exige finalité, consentement/contrat approprié, durée de rétention, suppression/export et transparence clairs. Un résumé de conversation reste une donnée personnelle ; le résumer ne l'anonymise pas.

## 4. Garde-fous théologiques et pastoraux

### 4.1 Une politique éditoriale explicite avant le prompt

**Recommandation.** Bible Strong doit décider et publier :

- le socle doctrinal éventuel du produit ;
- les traditions couvertes et la manière de traiter les désaccords ;
- la hiérarchie entre texte biblique, lexiques, sources historiques, commentaires et modèle ;
- les sujets sur lesquels l'assistant doit seulement exposer des positions nommées ;
- les actes de langage interdits : « Dieu me dit de te dire », prophétie personnalisée, condamnation/assurance du salut d'une personne, imitation de Jésus/du Saint-Esprit/d'un pasteur ;
- la conduite à tenir pour détresse, suicide, abus, violence, santé mentale, santé et droit.

Ce document doit appartenir à un comité éditorial humain et être transformé en cas d'évaluation. Le prompt système en est une implémentation partielle, pas la source d'autorité.

### 4.2 Séparer les niveaux de certitude

Le modèle doit marquer les affirmations comme :

1. **texte** : ce que dit explicitement un passage cité ;
2. **donnée** : fait lexical, historique ou littéraire attribué ;
3. **interprétation** : lecture d'une tradition/auteur nommé ;
4. **application** : piste de réflexion, jamais parole divine personnalisée.

Pour un sujet disputé, la réponse nomme les positions, indique les principaux textes mobilisés et évite de fabriquer un faux consensus. Si Bible Strong choisit une perspective confessionnelle, elle doit être visible et non cachée dans le prompt.

### 4.3 Signaux venant de produits et institutions chrétiennes

Les déclarations publiques ci-dessous sont des faits sur le **positionnement annoncé** par leurs éditeurs, pas des audits indépendants de leurs performances ou de leur sécurité.

**Logos/Faithlife — assistant de recherche.** Logos décrit Smart Search comme une combinaison de recherche lexicale, sémantique, classement et extraits. Smart Bible Search ferait localiser les passages par l'IA, puis relirait le texte dans la Bible choisie plutôt que de laisser le modèle réciter le verset. Study Assistant synthétise les livres choisis et cite l'emplacement exact ; l'utilisateur peut limiter le corpus à une collection ou un ouvrage. Logos dit aussi ne pas employer l'IA dans Bible Word Study, ses données éditoriales structurées y étant plus fiables ([How Logos uses AI](https://support.logos.com/hc/en-us/articles/35181728416397-How-Logos-uses-AI), [Responsible Use of AI in Bible Study, 2025](https://www.logos.com/grow/live-responsible-ai-bible-study/)). C'est le précédent le plus proche de l'architecture recommandée : récupération d'abord, texte canonique relu hors LLM, citations profondes et génération différente selon le cas d'usage.

**Magisterium AI — corpus confessionnel explicite.** Le produit annonce des citations inline ouvrant le document et son contexte. Son mode « Magisterial » limite la recherche aux enseignements officiels catholiques ; d'autres modes élargissent les sources. Il annonce aussi pouvoir s'abstenir quand les sources sont insuffisantes ou la demande hors corpus ([citations](https://help.magisterium.com/chat/understanding-citations), [modes de sources](https://help.magisterium.com/chat/prompt-modes-explained), [refus](https://help.magisterium.com/chat/answer-bailed-out-or-flagged)). Ce n'est pas une neutralité générale : la perspective et la hiérarchie d'autorité sont visibles. Sa politique de confidentialité mentionne plusieurs sous-traitants et des chats conservés par défaut ; ce modèle de rétention ne devrait pas être repris sans décision explicite ([Privacy Policy](https://www.magisterium.com/privacy-policy)).

**Anchor — règles pastorales publiées.** Anchor annonce une règle « cite or refuse », des versets provenant du corpus indexé et non de la mémoire du modèle, cinq lentilles théologiques nommées, et des refus pour prononcer le salut d'une personne, interpréter un rêve comme parole de Dieu, prophétiser, diagnostiquer ou donner des conseils médicaux/juridiques/financiers. Pour l'automutilation, il dit présenter les ressources de crise avant le contenu biblique et affirme tester ces catégories adversarialement ([fonctionnement](https://www.anchor.bible/), [corpus](https://www.anchor.bible/sources)). Cette liste est une excellente matière pour des tests Bible Strong. Réserve importante : la page technique déclare envoyer les questions à Gemini, tandis que la page de confidentialité ne nomme pas Google parmi les destinataires ([Privacy](https://www.anchor.bible/privacy)) ; ses promesses de confidentialité nécessitent donc clarification.

**Bible Chat — validation de marché mais référence de confiance plus faible.** L'éditeur affirme utiliser RAG, citations, choix de dénomination et supervision par un conseil multi-traditions, tout en disant que l'IA ne remplace ni Église ni responsable religieux ([About](https://thebiblechat.com/about-us/), [limites annoncées](https://thebiblechat.com/blog/embracing-technology-with-faith-exploring-bible-chat-and-ais-role/)). Ses conditions excluent le conseil médical, psychologique, juridique ou pastoral, mais sa politique permet de collecter notamment dénomination, croyances, prompts et outputs et liste de nombreux prestataires ([Privacy](https://thebiblechat.com/privacy-policy/), [Terms](https://thebiblechat.com/terms-and-conditions/)). Cela montre pourquoi la promesse « Bible + RAG » ne suffit pas à une posture de confidentialité.

**GotQuestions — décision de ne pas lancer.** Ce ministère dit avoir expérimenté un bot sur son propre corpus mais refuse qu'une IA réponde en son nom : une faible proportion d'erreurs pourrait encore égarer sur un sujet important ; aucun contenu IA n'y est publié sans revue humaine approfondie ([podcast et transcription, 2025](https://podcast.gotquestions.org/episode-269.html), [position officielle](https://www.gotquestions.org/GotQuestions-replaced-by-AI.html)). C'est un contre-exemple utile : pour certains usages spirituels, la décision responsable peut rester de ne pas générer.

**YouVersion et BibleProject — enrichir sans prose libre.** YouVersion déclare utiliser l'IA pour recommandations/analyse mais pas pour produire de nouveau contenu généré, et ses conditions Platform interdisent la génération de sorties IA pour les utilisateurs sans autorisation écrite préalable ([Privacy](https://www.bible.com/privacy), [Platform Terms](https://platform.youversion.com/terms)). BibleProject ne documente pas d'assistant IA public ; ses surfaces relient plutôt déterministiquement passage, vidéos, podcasts, guides et ressources ([Help Center](https://help.bibleproject.com/hc/en-us/articles/4479394508183-I-have-a-Bible-question-Can-you-help)). Le premier garde-fou peut donc être de ne pas générer lorsque des enrichissements éditoriaux suffisent.

**Biblica — exigences d'un ayant droit.** Sa politique 2026 autorise certains résumés/contextes sous licence, mais exige transparence IA, contrôle humain, intégrité doctrinale et interdit l'imitation de Dieu, Jésus, du Saint-Esprit, d'un pasteur ou conseiller spirituel ([Biblica](https://www.biblica.com/publisher-ai-policy/)). Elle rappelle que les garde-fous sont aussi contractuels et éditoriaux, pas uniquement techniques.

**Projet open source — limites rendues visibles.** Un Bible Assistant open source publie un model card qui reconnaît encore des risques de références inventées et de biais confessionnels malgré RAG et fine-tuning ([model card](https://github.com/t-timms/bible-ai-assistant/blob/main/docs/MODEL_CARD.md)).

**Inférence.** Les précédents les plus prudents bornent un corpus, récupèrent le texte biblique hors du LLM, déclarent une tradition ou exposent les divergences, citent les sources, refusent certains actes pastoraux et conservent une voie « ne pas générer ». Aucun des produits étudiés ne publie toutefois un taux d'hallucination audité indépendamment, une défense démontrée contre la prompt injection, ni la preuve que chaque citation soutient réellement chaque affirmation.

## 5. Sécurité : jailbreak, injection, extraction et hors-sujet

### 5.1 Modèle de menace

OWASP classe notamment comme risques majeurs la prompt injection, la divulgation d'informations sensibles, l'excès d'agence, la fuite du prompt système, les faiblesses vectorielles, la désinformation et la consommation non bornée ([Top 10 2025](https://genai.owasp.org/llm-top-10/)). OWASP précise que RAG et fine-tuning ne suppriment pas la prompt injection et qu'aucune prévention infaillible n'est connue ([LLM01:2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)). Les vector stores ajoutent des risques d'accès croisé, d'inversion d'embeddings et d'empoisonnement ; OWASP recommande partitionnement, contrôle d'accès, validation des sources et journalisation de récupération ([LLM08:2025](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)).

### 5.2 Défense en profondeur recommandée

**Avant le modèle**

- API key uniquement côté Worker ; App Check/attestation, rate limiting par utilisateur/appareil/IP et budgets journaliers ;
- longueur maximale, taille de conversation maximale et nombre d'appels d'outils borné ;
- routeur de domaine : Bible/étude accepté, demande manifestement hors-sujet refusée sans modèle coûteux ;
- modération des risques généraux et classifieur propre aux risques pastoraux ;
- documents du corpus importés seulement par une chaîne éditoriale authentifiée, jamais directement par un utilisateur dans le store de confiance ;
- contenu utilisateur et contenu récupéré balisés comme **données non fiables**, jamais concaténés aux instructions privilégiées.

**Autour des outils**

- outils en lecture seule en V1, allowlist fermée, arguments JSON stricts ;
- identité et autorisation calculées par le serveur, jamais fournies par le modèle ;
- filtres de droits/tenant appliqués dans la requête avant similarité ;
- limites de lignes, de segments et de citations ; aucune capacité d'export en masse ;
- pas d'URL arbitraire, de navigateur web, de code, d'e-mail ou d'action externe dans le chatbot biblique initial.

**Après le modèle**

- validation du schéma et rejet de tout champ inattendu ;
- vérification déterministe des références bibliques et des `source_span_ids` ;
- détection de longues reproductions ou de motifs ressemblant au prompt interne ;
- rendu texte sûr : pas de HTML/JavaScript/Markdown actif ni d'URL non issue des sources autorisées ;
- seconde passe de vérification des affirmations à risque, sans considérer un second LLM comme preuve absolue ;
- mécanisme visible « signaler cette réponse » et kill switch par fonctionnalité/modèle.

OpenAI recommande explicitement red teaming, modération, revue humaine pour les domaines sensibles, limitation des entrées/sorties et préférence pour des matériaux backend validés plutôt que pour une génération libre ([Safety best practices](https://developers.openai.com/api/docs/guides/safety-best-practices)). Le NIST organise la gestion continue des risques génératifs en gouverner, cartographier, mesurer et gérer, sur tout le cycle de vie ([NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)).

### 5.3 « Empêcher le reverse engineering » : objectif réaliste

Il n'est pas réaliste de garantir que personne ne déduira les règles ou n'extraira des fragments du prompt. La bonne cible est : **aucune extraction ne donne accès à un secret, un privilège ou une quantité significative de contenu protégé**.

Mesures concrètes :

- considérer le prompt comme publiable ; secrets uniquement dans le gestionnaire de secrets ;
- servir des extraits minimaux à chaque requête, jamais le corpus entier ;
- limiter citations cumulées, pagination, fréquence et similarité des requêtes d'extraction ;
- détecter les demandes séquentielles de reconstruction ;
- séparer les corpus par droits et ne pas calculer d'embeddings externes lorsqu'une licence l'interdit ;
- conserver des traces techniques pseudonymisées des récupérations et refus pour détecter l'abus, sans journaliser par défaut le texte spirituel exact.

## 6. Évaluation, supervision et observabilité

### 6.1 Un jeu d'évaluation Bible Strong est indispensable

Le benchmark doit être créé **avant** le choix définitif du modèle. Il devrait contenir des questions françaises et anglaises relues par des personnes compétentes, réparties par surface : référence exacte, résumé, histoire, Strong, recherche sémantique, comparaison, désaccord doctrinal, absence de preuve, crise pastorale, hors-sujet, injection et extraction.

Pour chaque cas : contexte attendu, passages/sources pertinents, éléments obligatoires/interdits, statut attendu (répondre, nuancer, s'abstenir, refuser) et gravité d'une erreur. Conserver un sous-ensemble secret contre l'optimisation artificielle au benchmark.

### 6.2 Mesures séparées

| Couche | Mesures proposées |
|---|---|
| Résolution | validité et exactitude des références, entités et filtres |
| Retrieval | recall@k, MRR/nDCG, pertinence, diversité de source, bon passage dans top-k |
| Reranking | gain nDCG/recall, latence et coût additionnels |
| Réponse | exactitude éditoriale, fidélité aux sources, couverture, clarté |
| Citations | précision par affirmation, complétude, lien vers le bon segment |
| Abstention | rappel quand preuve absente et taux de refus excessifs quand preuve présente |
| Théologie | distinction fait/interprétation, attribution des traditions, absence d'autorité usurpée |
| Sécurité | taux de succès d'attaque, fuites, accès croisé, hors-sujet, reproduction protégée |
| Produit | latence p50/p95, erreurs, abandon, ouverture des sources, signalements |
| Économie | tokens entrée/sortie, appels modèle/reranker, cache hit, coût par fonctionnalité |

RAGAS propose de séparer pertinence du contexte, fidélité de la réponse et qualité de génération ([EACL 2024](https://aclanthology.org/2024.eacl-demo.16/)). Ces juges automatiques accélèrent les comparaisons, mais les décisions théologiques et les cas à fort impact exigent un échantillon annoté humain et des audits réguliers.

### 6.3 Versionner et observer sans lire les âmes

Chaque trace technique doit contenir des identifiants/version — modèle, prompt, corpus, embedding, reranker, route, sources sélectionnées, statut de validation, tokens, latence, coût — mais pas le texte exact des questions, notes ou réponses par défaut. Les exemples destinés à l'amélioration doivent provenir d'un consentement explicite (« partager cette conversation avec l'équipe »), être redacts et avoir une durée de rétention définie.

Déployer par canary : évaluations préproduction, équipe interne, petit pourcentage, puis extension. Une régression de citations, une hausse des signalements ou un changement de snapshot doit pouvoir désactiver seulement la génération tout en gardant la recherche classique disponible.

## 7. Confidentialité, réglementation et fournisseurs

### 7.1 Le fournisseur ne doit jamais être appelé depuis l'app

Toutes les requêtes passent par la passerelle Bible Strong. Cela protège la clé, permet quotas/abuse controls, redaction, routage, observabilité et changement de fournisseur. Le contrat interne doit être indépendant d'un format OpenAI/Anthropic/Google.

### 7.2 Les conditions « API commerciale » comptent plus que la marque

À la date de recherche :

- OpenAI indique ne pas utiliser les données API pour l'entraînement sauf opt-in ; les logs d'abuse monitoring peuvent contenir prompts/réponses et sont conservés jusqu'à 30 jours par défaut, avec contrôles ZDR/Modified Abuse Monitoring soumis à éligibilité. Certaines fonctions conservent un état applicatif ([Data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)).
- Anthropic indique ne pas entraîner ses modèles sur les contenus commerciaux sauf opt-in ; sa politique standard annonce une suppression des entrées/sorties API dans les 30 jours, avec exceptions et possibilités contractuelles, tandis que certaines fonctions/modèles ont des règles différentes ([Privacy Center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), [API retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)).
- Google indique que les prompts/réponses des services Gemini payants ne servent pas à améliorer ses produits, contrairement au régime gratuit hors exceptions régionales ; des logs limités peuvent exister pour la sécurité, et ZDR dépend des fonctions/configurations ([conditions Gemini](https://ai.google.dev/gemini-api/terms), [ZDR](https://ai.google.dev/gemini-api/docs/zdr)).

**Recommandation.** Comparer contractuellement : DPA et rôle de sous-traitant, région de traitement, rétention réelle par endpoint/fonction, ZDR, sous-traitants, transfert hors UE, entraînement, suppression, réponse aux incidents et droit d'audit. Ne pas utiliser un quota grand public/gratuit pour des notes ou conversations d'utilisateurs.

### 7.3 Transparence utilisateur

Depuis le 2 août 2026, l'article 50 de l'AI Act impose notamment d'informer la personne qu'elle interagit avec un système d'IA, sauf évidence suffisante ; la Commission a publié ses lignes directrices en juillet 2026 ([Commission européenne](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems), [texte de l'article 50](https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=fr)).

**Recommandation.** Marquer continuellement la surface « Généré par IA », expliquer les sources et limites, afficher la politique de données avant le premier chat, permettre suppression/export, et préciser que le service n'est ni Dieu, ni un humain, ni un pasteur/professionnel. Faire valider le périmètre juridique exact par un conseil ; cette note n'est pas un avis juridique.

## 8. Coût et performance

Le coût pertinent n'est pas seulement le prix d'un million de tokens. Il comprend : embeddings lors de la publication, stockage/index, requêtes FTS/vectorielles, reranking, tokens récupérés, génération, validations, modération, cache, logs et revue humaine. Les prix de modèles varient de plus d'un ordre de grandeur selon taille et niveau de raisonnement ; les pages officielles doivent servir au chiffrage au moment du prototype ([OpenAI](https://developers.openai.com/api/docs/pricing), [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), [Google](https://ai.google.dev/gemini-api/docs/pricing)).

Formule de suivi minimale par route :

```text
coût = embedding amorti
     + recherche/reranking
     + (tokens entrée × tarif entrée)
     + (tokens sortie × tarif sortie)
     + vérification/modération
     + infrastructure et supervision
```

**Recommandations de maîtrise :**

- générer par batch serveur et relire les enrichissements stables de chapitres/Strong très consultés ;
- petit modèle pour routeur, extraction et tâches structurées ; modèle plus capable seulement pour synthèse complexe ;
- récupérer peu de bons extraits plutôt que beaucoup de contexte ;
- limiter la réponse et résumer l'historique, sans mémoire illimitée ;
- mettre en cache seulement les réponses publiques déterministes avec clé incluant modèle/prompt/corpus/langue ; ne pas partager de cache personnalisé ;
- utiliser le traitement batch côté serveur pour la génération éditoriale ;
- budgets par route, alerte de dépense, plafond utilisateur et dégradation vers recherche sans génération ;
- ne commencer un pipeline multi-modèle que lorsqu'une évaluation démontre son gain net.

## 9. Faut-il plusieurs modèles ?

**Recommandation initiale.** Oui à plusieurs **composants spécialisés**, non à un essaim d'agents :

1. un modèle d'embedding multilingue ;
2. éventuellement un reranker ;
3. un petit modèle/classifieur pour intention et risque si les règles ne suffisent pas ;
4. un seul modèle génératif principal derrière une interface fournisseur ;
5. validateurs déterministes ;
6. un juge secondaire uniquement pour contrôle asynchrone/évaluation, jamais comme source de vérité.

Deux LLM qui se valident peuvent partager les mêmes erreurs. La diversité de fournisseur peut réduire certains modes communs, mais augmente coût, confidentialité, surface opérationnelle et difficulté d'explication. Commencer simple, mesurer, puis router vers un modèle plus puissant seulement pour les cas où le benchmark prouve un bénéfice.

## 10. Roadmap conseillée

### Phase 0 — Gouvernance et preuve de faisabilité

- charte éditoriale/théologique et règles pastorales ;
- inventaire des sources, droits IA/embedding/transfert et provenance ;
- threat model OWASP + AIPD préliminaire ;
- 200–500 cas d'évaluation, dont attaques et désaccords ;
- prototype backend sans exposition utilisateur, comparaison de 2–3 modèles et 2 embeddings.

**Critère de passage :** seuils convenus de retrieval, fidélité, citations, abstention, sécurité, latence et coût.

### Phase 1 — Assistant de lecture sourcé

- résumé/contexte de chapitre ;
- explication Strong et dictionnaire ;
- réponses structurées, sources ouvrables, feedback ;
- uniquement corpus éditorial Bible Strong, outils read-only, pas de mémoire personnelle.

### Phase 2 — Recherche biblique IA

- recherche hybride + reranking ;
- résultats classiques toujours visibles ;
- synthèse multi-source et traitement des perspectives ;
- cache public et observabilité de pertinence.

### Phase 3 — Organisation personnelle

- suggestions de tags/relations uniquement sur sélection explicite ;
- confirmation avant toute écriture ;
- éventuelle évaluation future d'une option on-device, hors périmètre du MVP ;
- politique de données et suppression validées.

### Phase 4 — Chat/méditation borné

- mémoire courte ou opt-in ;
- règles de crise et d'escalade humaine ;
- quotas renforcés, red team pastorale, audit externe ;
- lancement progressif avec kill switch.

## 11. Décisions à prendre dans l'issue

1. Bible Strong revendique-t-il une perspective confessionnelle précise, un socle nicéen large, ou une présentation pluraliste nommée ?
2. Quelles sources sont autorisées pour recherche, embedding, transfert à un fournisseur et citation générée ?
3. Quel niveau d'autorité humaine valide les résumés, les cas de benchmark et les incidents théologiques ?
4. Quelles fonctionnalités restent strictement read-only, et lesquelles pourront modifier notes/tags après confirmation ?
5. Le chat stocke-t-il un historique ; où, combien de temps et avec quel consentement ?
6. Quels seuils bloquent le lancement : citation, abstention, sécurité, coût, latence ?
7. Quel fournisseur/région satisfait le mieux DPA, rétention, droits des ressources et budget après le benchmark ?

## Conclusion

L'état de l'art ne permet pas de garantir une IA qui « ne part jamais en freestyle ». Il permet en revanche de construire un produit dont les erreurs sont moins probables, visibles, bornées et révocables. Pour Bible Strong, la sûreté vient principalement de la qualité du corpus et de ses droits, d'outils read-only étroits, d'une récupération hybride évaluée, de citations réellement vérifiées, d'une politique théologique explicite, de l'abstention et de la supervision humaine. Le modèle et son prompt viennent à l'intérieur de ce système ; ils ne sont pas le système.

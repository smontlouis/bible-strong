# Audit de l'accès Android au Resource service

Date : 23 septembre 2026. Code audité : `264ea9c662fa8035c1fab387f5e1b41a8368e4a4` sur `master`.
Statut : recommandation d'audit, pas décision d'architecture acceptée ni migration réalisée.

## Verdict

**Ne pas supprimer App Check et construire des sessions maison comme première étape.** Le besoin confirmé est de remplacer une condition d'admission qui refuse certains utilisateurs Android légitimes. App Check est déjà un mécanisme de jetons signés, temporaires et renouvelés ; un deuxième mécanisme ne résout pas automatiquement l'admission.

La prochaine expérience recommandée est un **pilote borné du fournisseur reCAPTCHA Enterprise natif Android, en conservant le contrat App Check actuel**, après inventaire des backends concernés. Cette piste réduit la surface de migration, mais n'est pas encore validée sur les appareils exclus. Elle requiert une nouvelle build native et comporte une dépendance à un produit en preview.

En parallèle, renforcer les protections contre l'abus indépendantes du fournisseur. Si le pilote ne satisfait pas les critères de compatibilité, de coût ou de maintenance, envisager une **session de secours limitée à certaines ressources**, avec une politique d'admission explicite. Ce serait un assouplissement assumé du niveau de confiance, pas une preuve que l'appelant est forcément Bible Strong.

Les détails techniques et sources des fournisseurs sont dans [l'audit complémentaire](./2026-09-23-app-check-android-provider-audit.md).

## 1. Objectif de sécurité à rendre explicite

Le produit doit préserver la lecture sans compte et l'accès aux copies hors ligne déjà installées. L'[ADR-0008](../adr/0008-serve-versioned-resources-through-domain-api.md) impose déjà cette indépendance vis-à-vis de Firebase Authentication. Ajouter silencieusement Firebase Auth anonyme ne serait pas un changement neutre : cela toucherait la notion de visiteur, l'adoption des données locales et les limites de création de comptes. Ce n'est pas la recommandation.

Les objectifs atteignables sont : refuser les appels sans autorisation acceptable, limiter l'automatisation et les dépenses, révoquer une autorisation abusive lorsque le mécanisme le permet, préserver les droits d'accès aux données privées, et maintenir la disponibilité pour les lecteurs légitimes.

L'objectif absolu « aucun appel possible autrement que depuis notre application » ne peut pas être garanti par une API consommée par des clients publics, notamment une application web. Un attaquant peut utiliser un vrai client, obtenir une autorisation, puis automatiser ou relayer des appels. Firebase présente explicitement App Check comme une réduction de certains abus. Une copie hors ligne fournie légitimement ne devient pas impossible à extraire grâce à l'authentification de l'API. [Garanties App Check](https://firebase.google.com/docs/app-check)

Ni un header Android, ni User-Agent, ni Origin/CORS, ni un identifiant d'installation fourni par le client ne prouvent l'authenticité de l'app. Un secret commun livré dans l'APK ou le JavaScript reste accessible aux détenteurs de l'application. Une signature par une clé d'installation peut prouver la possession de cette clé ; sans attestation ou admission fiable, elle ne prouve pas que la clé vient de Bible Strong. [RFC 8252, section 8.5](https://www.rfc-editor.org/rfc/rfc8252.html#section-8.5)

## 2. Ce que les observations établissent

La consultation Sentry précédente a confirmé la nouvelle instrumentation sur 27.0.17 (504) :

| Cas observé                                                                                                             | Conclusion étayée                                                                                       | Ce qui reste inconnu                                                                            |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Samsung Note10+ 5G, Android 12](https://sevn-apps.sentry.io/issues/144700493/events/5e1f204806ee48d982f64b80b6d0408d/) | `initialFailure` conserve un 403 d'attestation avant un `Too many attempts`; appareil signalé rooté     | Verdict précis de Google et provenance de l'APK                                                 |
| [Honor 50, Android 13](https://sevn-apps.sentry.io/issues/144700493/events/9efa58da92874a6bb2c75655be89ab59/)           | Refus d'attestation persistant, cinq échecs, délai applicatif de 30 secondes ; Sentry indique non rooté | Certification Play, modification éventuelle de la ROM, installation/signature et verdict Google |
| [ZTE Z2469N, Android 15](https://sevn-apps.sentry.io/issues/144700493/events/49b73b4c12184d83bf41117d2d1485c5/)         | Échec DNS vers Firebase ; appareil indiqué hors ligne                                                   | Durée et origine de l'incident réseau                                                           |

Ces échantillons établissent plusieurs causes. Ils ne mesurent ni le taux d'échec des utilisateurs actifs ni une amélioration statistique après l'update. Les compteurs Sentry de l'issue mélangent plusieurs erreurs, versions et répétitions ; ils ne constituent pas un dénominateur d'utilisation.

**Firebase production revérifié pendant cet audit**, formulaire consulté puis fermé sans sauvegarde : Play Integrity enregistré, `PLAY_RECOGNIZED` requis, `LICENSED` non requis, aucune exigence explicite de niveau d'intégrité appareil, TTL d'une heure, empreinte de signature inchangée. Le fournisseur natif alternatif est proposé dans la console sous « Fraud Defense (formerly known as reCAPTCHA Enterprise) », en preview, et n'est pas enregistré pour Android production.

Le réglage Firebase minimal concernant le niveau d'intégrité est donc déjà en place. Ne pas annoncer que sélectionner Basic dans Firebase assouplirait davantage cette configuration. Les vérifications implicites des autres verdicts subsistent. Les explications antérieures sur Android 9 et le sideload expriment une compatibilité possible, pas une garantie d'acceptation de chaque appareil. [Réglages Firebase](https://firebase.google.com/docs/app-check/android/play-integrity-provider)

Décocher `PLAY_RECOGNIZED` pourrait agir sans mise à jour client si ce contrôle explique le refus. Mais le réglage accepte également `UNEVALUATED`, et les documents publics ne permettent pas de garantir une preuve équivalente grâce au seul SHA-256 enregistré. Ce n'est pas une opération à faire aveuglément pour résoudre les incidents.

## 3. Protections présentes et limites importantes

### Vérification et distribution

Le [vérificateur du Worker](../../packages/resource-service/src/runtime/firebaseAppCheck.ts) vérifie signature, algorithme, type, émetteur, audience, expiration et App ID autorisé. Le [point d'entrée](../../packages/resource-service/src/runtime/worker.ts) applique l'autorisation avant cache, PostgreSQL et R2. Les [artefacts](../../packages/resource-service/src/runtime/r2ArtifactDelivery.ts) sont servis via un bucket privé et une liste de fichiers autorisés ; les requêtes Range, HEAD, ETag et SHA de publication sont déjà prises en charge.

Le format App Check permet de changer de fournisseur sans changer les URL ni le header `X-Firebase-AppCheck`. Mais le [contrat public des claims](https://firebase.google.com/docs/reference/admin/node/firebase-admin.app-check.decodedappchecktoken) n'offre pas de niveau de confiance ou de fournisseur utilisable comme autorité. Son `sub` est l'App ID Firebase, **pas un utilisateur ni une installation**. Notre vérificateur retourne actuellement un booléen.

Conséquence : les jetons Play Integrity et reCAPTCHA d'un même App ID sont traités de la même manière par le Worker actuel. Un header déclaratif ne permet pas de leur appliquer des droits fiables différents. Le web reCAPTCHA est déjà un fournisseur accepté par cette API ; la protection globale ne repose donc pas uniquement sur l'attestation native Android.

### Périmètre plus large que les téléchargements

Le [client de l'assistant](../../apps/expo/src/features/study-assistant/client.ts) appelle aussi `getResourceAppCheckToken()` et transmet ce token avec un token Firebase Auth à un backend externe. Changer le fournisseur de l'instance Firebase peut donc toucher l'assistant et les autres services faisant confiance au même App ID. Le serveur privé de l'assistant et ses budgets n'ont pas été audités ici.

Le Resource service contient aussi des routes de **recherche sémantique faisant appel à Workers AI**, ainsi qu'un POST de télémétrie. Une permission de secours « lecture » ne doit pas signifier arbitrairement « tous les GET » ou « toutes les routes /v1 ». Les routes doivent être classées selon leur coût et les droits nécessaires, avec refus par défaut des routes non prévues pour ce parcours.

### Limites actuelles

Dans [resourceRequestProtection.ts](../../packages/resource-service/src/runtime/resourceRequestProtection.ts), le compteur est indexé sur le SHA-256 du token App Check. Un nouveau token produit donc une nouvelle clé. Le mécanisme est utile contre les rafales mais ne crée pas une identité persistante ni un quota quotidien.

La [configuration](../../packages/resource-service/wrangler.jsonc) définit 300 requêtes/minute pour lecture et recherche, 120 pour artefacts et télémétrie. Les artefacts sont comptés en requêtes, pas en octets ni en nombre de téléchargements simultanés. Aucune limite de dépense globale n'apparaît dans cette couche. En cas de panne du compteur, le code laisse passer la requête déjà autorisée et journalise l'incident : c'est un choix de disponibilité explicite, à réexaminer pour les chemins coûteux ou moins fiables.

Cloudflare précise que ces compteurs sont propres à chaque localisation et approximatifs. Ce n'est pas un système de comptabilité globale. Une limite IP stricte serait aussi problématique pour les utilisateurs partageant une connexion ou une adresse d'opérateur. Préférer des signaux combinés ; si un plafond financier strict est requis, prévoir une autorité de comptage cohérente ou une limite fournisseur dédiée, sans imposer un aller-retour global à chaque chapitre mis en cache. [Cloudflare Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

Autres points à inventorier avant de durcir : l'allowlist production contient des App IDs Android/iOS de plusieurs environnements, et le workflow de publication utilise un mécanisme debug protégé pour ses contrôles. Ne pas retirer des IDs ou identifiants opérationnels sans identifier leurs utilisateurs. Les logs Worker sont échantillonnés à 10 % ; leur absence ne démontre pas l'absence d'une catégorie d'incidents.

### Vérifications légères en production

Quelques requêtes sans credentials, sans téléchargement de ressource et sans test de charge ont été faites pendant l'audit :

- `/health` avec un User-Agent applicatif : HTTP 200.
- Lecture d'un chapitre sans token, même avec User-Agent applicatif : HTTP 401.
- Même lecture avec Origin du web Bible Strong et indication Android : HTTP 401.
- Le client HTTP Python par défaut reçoit HTTP 403, code Cloudflare 1010, y compris sur `/health`.

Le dernier résultat confirme un filtrage en amont compatible avec Browser Integrity Check ; changer le User-Agent suffit à atteindre le Worker. Ce filtrage ne prouve donc pas l'identité de l'app. L'intégralité des règles WAF et des paramètres Cloudflare n'a pas été inspectée. Ces réponses ne démontrent aucun lien causal entre ce filtrage et les 403 d'attestation émis par Firebase dans Sentry. [Erreur 1010 Cloudflare](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/)

## 4. Comparaison des directions

| Option                                                                     | Gain                                                                                                    | Risques / limites                                                                                                                       | Avis                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Garder Play Integrity seul et ajuster les retries                          | Migration minime, réduit les répétitions                                                                | Les refus permanents restent ; ne résout pas l'accès des appareils exclus                                                               | Utile mais insuffisant pour le problème observé                                 |
| Changer le fournisseur Android en conservant App Check                     | Même contrat API, SDK gère expiration/cache, anciens clients gardent Play Integrity                     | Nouveau build, preview, scores pouvant refuser des utilisateurs, coût, maintenance du SDK, périmètre de confiance partagé               | Premier pilote recommandé                                                       |
| Fournisseur App Check personnalisé                                         | Même vérification serveur, admission propre                                                             | Il faut réellement valider une preuve ; mêmes effets de confiance sur les autres backends ; intégration et exploitation supplémentaires | À envisager pour un besoin précis, pas pour changer seulement la forme du token |
| Session propre limitée au Resource service                                 | Droits propres aux ressources, quotas persistants, possibilité de politique d'admission plus permissive | Point d'émission exposé, création massive de sessions, gestion de renouvellement/révocation, double contrat, plus de scénarios de panne | Plan de secours justifié si le besoin d'isolation/compatibilité est démontré    |
| Supprimer l'autorisation et compter sur CORS, User-Agent ou clé dans l'app | Faible effort apparent                                                                                  | Appels reproductibles, aucune preuve fiable de l'app, protections insuffisantes pour les routes coûteuses                               | Écarté                                                                          |

### Limites du pilote reCAPTCHA

La version RNFirebase installée, 23.7.0, n'expose pas ce fournisseur Android. Le pilote exige un pont natif et un BoM compatible. Android 9 satisfait les minima OS vérifiés, mais cela ne garantit pas un score accepté. Google Play services sont recommandés plutôt qu'obligatoires ; des dépendances/signaux Play peuvent néanmoins subsister. La clé doit être configurée pour la distribution hors Play si ce canal doit être accepté. [Recherche détaillée et sources](./2026-09-23-app-check-android-provider-audit.md)

Le pilote doit sélectionner un fournisseur par build/cohorte au départ. Ajouter deux configs dans Firebase n'implémente aucun fallback automatique. Développer d'emblée un fournisseur composite ajouterait une autre variable au diagnostic.

Ce fournisseur est en preview et peut refuser sur score. La facturation dépend des évaluations lors des attestations/renouvellements. Les SDK mobiles reCAPTCHA ont un calendrier d'arrêt : prévoir des builds maintenues et le traitement des anciennes versions. Ces contraintes peuvent faire préférer une autre option selon les résultats mesurés ; elles empêchent de promettre aujourd'hui une solution universelle.

## 5. Migration recommandée et critères de passage

### Étape A — établir la mesure et les frontières

1. Mesurer les tentatives et réussites, pas seulement les erreurs Sentry : acquisition du token, demande de lecture, début/fin de téléchargement, latence, classe d'erreur, version native et update OTA. Ne pas journaliser les tokens, contenus privés ou requêtes de recherche en clair.
2. Distinguer au minimum lecture déterministe, recherche textuelle, recherche sémantique, fichiers, télémétrie et opérations de compte/assistant.
3. Mesurer les volumes habituels et les coûts ; simuler les nouveaux seuils dans les logs avant de les imposer. Prévoir un budget propre aux opérations coûteuses et une politique explicite en cas de panne des compteurs.
4. Inventorier les services et environnements acceptant l'App ID Android. Un essai isolé peut valider l'intégration ; un essai sur la vraie signature et le vrai canal de distribution reste nécessaire pour confirmer les appareils de production.

### Étape B — expérience native bornée

Ajouter le fournisseur alternatif sans supprimer la configuration Play Integrity des clients publiés. Construire un pilote et essayer des appareils réellement concernés : Android 9, Honor non rooté, appareils atypiques, installations Play et APK officiels hors Play. Un téléphone de développement ou un émulateur seul ne suffit pas.

L'enregistrement d'un nouveau fournisseur pour l'App ID de production ouvre sa voie d'émission pour cet App ID. La cohorte/build limite le déploiement auprès des utilisateurs légitimes ; elle n'est pas une frontière d'autorisation contre un attaquant. Le profil de confiance doit donc être acceptable pour tous les backends concernés **avant** cet enregistrement, même pour un petit pilote. Commencer dans un environnement isolé lorsque cette condition n'est pas encore remplie.

Les critères pour retenir cette voie sont : les cas bloqués ciblés réussissent lecture et téléchargement ; les anciens clients continuent à fonctionner ; renouvellement, reprise réseau et reprise de fichier réussissent ; les autres consommateurs App Check ne régressent pas ; coût et maintien du SDK sont acceptables. Fixer les seuils de succès/latence à partir de la référence de l'étape A, pas d'un pourcentage arbitraire.

### Étape C — déploiement compatible

Conserver URL, payloads, ETag/SHA, Range et vérification avant cache. Avec un nouveau fournisseur produisant le même contrat App Check, aucun second format d'autorisation du Resource service n'est nécessaire. Vérifier tout de même de vrais jetons des deux fournisseurs avant d'élargir la cohorte.

**Point de risque concret dans Expo :** [app.config.ts](../../apps/expo/app.config.ts) utilise un `runtimeVersion` fixe et `checkAutomatically: 'NEVER'`. Le helper de mise à jour automatique est défini, mais aucun appel n'a été trouvé dans les sources inspectées ; des vérifications manuelles existent dans les réglages et la récupération d'erreur. Ne pas compter sur un OTA automatique pour migrer toute la population. Tout ajout de code natif impose une nouvelle build et un runtime compatible distinct pour éviter qu'un ancien binaire charge du JavaScript utilisant une API native absente. [Documentation Expo](https://docs.expo.dev/eas-update/runtime-versions/)

Les versions actuellement fonctionnelles doivent garder Play Integrity aussi longtemps que nécessaire. Les versions déjà refusées ne seront pas guéries par la seule acceptation serveur d'un nouveau token qu'elles ne savent pas obtenir.

### Si une session propre devient nécessaire

Le serveur doit accepter ancien App Check ou nouvelle autorisation **validée par des règles séparées**, tout en attribuant les droits côté serveur. Déployer cette capacité sur 100 % des instances avant de livrer des clients qui en dépendent ; un déploiement partiel du Worker pourrait provoquer des refus intermittents. L'expansion de la politique peut ensuite être graduelle.

Le nouveau mécanisme exige au minimum :

- admission vérifiable et protection de l'émission elle-même ; une erreur Play Integrity rapportée par le client n'est pas une preuve ouvrant des droits ;
- portée limitée par routes, méthodes et ressources, audience/émetteur propres, aucun secret partagé dans les clients ;
- compteurs rattachés à une session serveur durable, conservés au renouvellement ; gestion de la création répétée de nouvelles sessions, qui reste possible pour un invité ;
- expiration choisie selon les latences/connectivité, renouvellement partagé entre appels concurrents et reprise après réponse perdue ; quinze minutes n'est pas une valeur validée pour notre public ;
- politique de révocation, stockage et rotation des clés, tests de tokens expirés/falsifiés, absence de confusion avec les tokens Firebase Auth ou App Check ;
- traitement explicite de l'expiration entre deux requêtes Range, sans abandonner inutilement un gros fichier ni modifier son intégrité SHA ;
- adaptation des deux transports clients : fetch de lecture **et** téléchargement Expo FileSystem. Ne pas remplacer la valeur de `getResourceAppCheckToken()` par un token maison, car l'assistant l'utilise aussi ;
- CORS mis à jour si un nouveau header est utilisé par le web ; la liste actuelle n'autorise pas `Authorization` ;
- métriques séparant les erreurs de création de session, renouvellement, autorisation, quotas et téléchargements.

Un JWT court ne fournit pas une révocation immédiate à lui seul. Celle-ci exige un état consulté côté serveur, une liste de révocation/version ou l'attente de l'expiration. Si des refresh tokens sont introduits, leur rotation/protection et le traitement des réutilisations doivent être définis. Les pratiques OAuth sur les clients publics sont pertinentes, sans prétendre que le protocole maison serait automatiquement OAuth. [RFC 9700, section 4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14)

Le niveau de sécurité global des routes accessibles par les deux mécanismes sera celui de la voie la plus permissive. Conserver App Check iOS/web ne supprime pas ce risque : un attaquant peut essayer la voie de secours.

### Retour arrière

Un retour arrière du serveur doit rester compatible avec les credentials déjà distribués. Ne pas revenir à une ancienne version du Worker ignorant la nouvelle autorisation. L'interrupteur opérationnel doit contrôler le déploiement/les nouvelles admissions avec une politique documentée pour le renouvellement et les autorisations existantes. En cas de compromission, la révocation immédiate peut prendre le pas sur la continuité ; ce compromis doit être explicite.

Pour le pilote fournisseur, remettre Play Integrity sur des appareils qu'il refuse réintroduirait le problème. Ne pas promettre un rollback transparent pour cette population. Conserver les configurations et prévoir un correctif client ou une autre voie opérationnelle avant généralisation.

## 6. Validation effectuée et limites de l'audit

49 tests existants du Resource service passent : `firebaseAppCheck`, `resourceRequestProtection`, `worker`, `r2ArtifactDelivery`. Ils couvrent notamment tokens invalides, refus avant accès protégé, compteurs, cache, Range et métadonnées. Les doubles de test ne remplacent pas un essai avec un vrai token reCAPTCHA.

19 tests clients existants passent également dans `resourceAppCheck-test`, `resourceAppCheckRequest-test` et `downloadResourceArtifact-test` : partage d'acquisition/renouvellement, conservation de l'erreur initiale, temporisation et traitement des refus. Aucun de ces tests ne mesure les scores reCAPTCHA ou ne valide une intégration native encore absente.

Lecture du code et des ADR, vérification du formulaire Firebase de production, requêtes de contrôle sans token et documentation officielle ont été réalisées. Les types Cloudflare publiés `5.20260923.1` ont également été consultés pour le binding de limite.

Non vérifiés : acceptation reCAPTCHA sur les appareils concernés, nombre total d'utilisateurs touchés, coûts réels/quotas disponibles, graphe Gradle final du pilote, intégralité des règles WAF, déploiement réel de tous les backends privés et politiques d'enforcement Firebase hors du Resource service. Aucun test de charge ou de création massive d'identités n'a été exécuté.

Seuls les documents d'audit ont été ajoutés. Aucune désactivation, inscription de fournisseur, modification de code d'exécution, émission de credentials ou mise en production n'a été effectuée.

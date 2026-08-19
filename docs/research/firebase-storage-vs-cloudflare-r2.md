# Firebase Storage / Google Cloud Storage vs Cloudflare R2

_Vérification des tarifs et capacités au 19 août 2026. Prix publics en USD, hors taxes et éventuelles remises contractuelles._

## Réponse courte

Pour les artefacts éditoriaux téléchargés par beaucoup d'utilisateurs (bases SQLite, JSON, audio, images), **R2 est réellement plus intéressant économiquement dès que le trafic sortant devient significatif**. Le stockage est un peu moins cher, mais la différence décisive est l'egress Internet : gratuit chez R2 contre environ **0,12 $/GiB** au premier palier Google Cloud Storage.

Firebase reste toutefois plus simple pour les fichiers privés : SDK mobile, Firebase Authentication, Security Rules et App Check fonctionnent ensemble sans passerelle applicative à construire. Avec R2, cette protection doit être recréée dans un Worker ou remplacée par des URL présignées.

Le dépôt configure actuellement `bible-strong-app.appspot.com` dans les trois environnements. Il s'agit donc du modèle tarifaire Firebase des buckets historiques `*.appspot.com`, pas de celui des nouveaux buckets `*.firebasestorage.app`.

## Comparaison tarifaire

| Poste | Firebase Storage actuel (`*.appspot.com`) | GCS Standard régional | R2 Standard |
|---|---:|---:|---:|
| Stockage | 5 GB gratuits, puis **0,026 $/GB-mois** | environ **0,020 $/GiB-mois**, selon la région | **0,015 $/GB-mois** |
| Sortie Internet | 1 GB/jour gratuit, puis **0,12 $/GB** | **0,12 $/GiB** jusqu'à 10 TiB/mois vers la plupart des destinations | **gratuite** |
| Écritures / Class A | 20 000/jour gratuites, puis **0,05 $/10 000** | **5 $/million** en bucket régional | **4,50 $/million** |
| Lectures / Class B | 50 000/jour gratuites, puis **0,004 $/10 000** | **0,40 $/million** en bucket régional | **0,36 $/million** |
| Palier gratuit | quotas ci-dessus, renouvelés chaque jour | 5 GB-mois, 5 000 Class A, 50 000 Class B et 100 GB de transfert, avec restrictions de régions nord-américaines | 10 GB-mois, 1 M Class A, 10 M Class B ; egress toujours gratuit |

Sources : [tarifs Firebase](https://firebase.google.com/pricing), [tarifs Google Cloud Storage](https://cloud.google.com/storage/pricing), [tarifs R2](https://developers.cloudflare.com/r2/pricing/).

Pour les nouveaux buckets Firebase `*.firebasestorage.app`, Firebase annonce mensuellement 5 GB-mois, 100 GB téléchargés, 5 000 uploads et 50 000 downloads gratuits, puis renvoie vers les tarifs GCS. Cela ne décrit pas le bucket historique utilisé actuellement par Bible Strong. Les tarifs GCS varient par emplacement ; il faut donc contrôler le SKU et la région réels avant toute projection définitive.

### Ordre de grandeur

Avec **100 GB stockés**, **1 000 GB téléchargés dans le mois** et **1 million de téléchargements**, répartis régulièrement :

- bucket Firebase historique : environ **118,87 $/mois** (2,47 $ de stockage + 116,40 $ de transfert ; les lectures restent sous le quota journalier dans cet exemple) ;
- R2 Standard : environ **1,35 $/mois** après le palier gratuit ; transfert et lectures inclus ici.

Ce calcul indicatif exclut le Worker, les autres services, les taxes et les différences GB/GiB. Il montre surtout que **le volume téléchargé, et non le volume stocké, commande la décision**. À 100 GB de stockage sans téléchargement notable, l'écart n'est que d'environ 1,10 $/mois entre les deux modèles historiques.

## Cache Cloudflare

R2 est le stockage objet ; Cloudflare Cache/CDN peut être placé devant lui avec un domaine personnalisé. Le cache réduit les lectures Class B qui atteignent R2 et améliore la latence. Cloudflare recommande Smart Tiered Cache ; certains formats, notamment JSON, nécessitent une règle explicite pour être mis en cache. Le domaine `r2.dev` est réservé au développement et ne fournit ni cache, ni WAF, ni gestion des bots. [Documentation R2 + Cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)

Pour les ressources **publiques, immuables et versionnées**, le montage naturel est donc :

`resources.bible-strong.app` → Cloudflare Cache → R2

Le cache économise surtout les opérations et la latence, puisque l'egress R2 est déjà gratuit.

## Ressources privées et App Check

Firebase Storage sait appliquer directement Firebase Authentication, des règles par chemin/utilisateur et App Check. Les téléchargements via SDK peuvent rester soumis aux Security Rules ; Firebase recommande de surveiller les métriques avant d'activer l'enforcement App Check afin de ne pas bloquer les anciennes versions de l'app. [Security Rules](https://firebase.google.com/docs/storage/security/rules-conditions), [téléchargements Firebase](https://firebase.google.com/docs/storage/web/download-files), [enforcement App Check](https://firebase.google.com/docs/app-check/enable-enforcement)

R2 offre deux voies principales :

- un Worker vérifie le token App Check, applique l'autorisation, puis lit le bucket via un binding R2 ; Firebase documente l'envoi et la vérification des tokens pour un backend personnalisé. Cette intégration est à notre charge ; [backend personnalisé App Check](https://firebase.google.com/docs/app-check/custom-resource-backend), [binding R2 dans un Worker](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) ;
- l'API émet une URL R2 présignée, valable de 1 seconde à 7 jours. C'est un bearer token réutilisable jusqu'à expiration. Point important : les URL présignées R2 ne fonctionnent que sur le domaine S3 R2, **pas sur un domaine personnalisé**, donc elles ne se combinent pas directement avec le cache CDN de ce domaine. [URL présignées R2](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

Google Cloud Storage propose également des URL signées temporaires. Firebase fournit en plus des URL de téléchargement longues durées et révocables ; ce ne sont pas le même mécanisme ni la même durée de vie. [URL signées GCS](https://cloud.google.com/storage/docs/access-control/signed-urls)

Si chaque téléchargement privé passe par un Worker, ajouter son coût : le plan gratuit couvre 100 000 requêtes/jour ; le plan payant commence à 5 $/mois avec 10 millions de requêtes mensuelles et du temps CPU inclus. [Tarifs Workers](https://developers.cloudflare.com/workers/platform/pricing/)

## Recommandation pour Bible Strong

Adopter **R2 Standard + domaine personnalisé + cache** pour les artefacts éditoriaux publics ou simplement destinés à être distribués largement dans l'app : bases de ressources, JSON versionnés, images et audio librement redistribuable. Utiliser des clés immuables contenant la révision et des `Cache-Control` longs ; publier un petit manifeste pour pointer vers la révision active.

Conserver temporairement Firebase Storage pour les fichiers réellement privés ou dépendants de Security Rules, jusqu'à ce que la passerelle Worker + App Check soit conçue et testée. Pour les ressources sous licence, décider explicitement si une URL bearer temporaire est acceptable ; sinon, les servir derrière le Worker et ne pas exposer le bucket.

La migration elle-même peut utiliser Super Slurper ou Sippy sans frais propres à l'outil Cloudflare, mais Firebase/GCS peut facturer la lecture et la sortie à la source. [Tarification de la migration R2](https://developers.cloudflare.com/r2/pricing/#data-migration-pricing)

En bref : **oui à R2 pour la distribution massive**, mais pas comme simple remplacement aveugle de Firebase Storage. Le bon découpage est public/cacheable sur R2, privé derrière une politique d'accès explicite.

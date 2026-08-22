# Économie unitaire d'un abonnement IA Bible Strong avec Gloo

**Date :** 21 août 2026

**Objet :** estimer la viabilité d'IAP mensuels à 3,99 €, 4,99 € et 6,99 € pour financer les fonctions IA de Bible Strong. Cette note ne modifie pas l'issue GitHub.

## Conclusion

Les trois prix peuvent couvrir les coûts Gloo. Le prix recommandé pour financer le produit et sa croissance est toutefois **6,99 €/mois**, avec un abonnement annuel à **69,99 €/an** et, au lancement, environ **100 interactions génératives mensuelles**. Un prix fondateur temporaire à 59,99 €/an reste possible. Le plafond pourra monter vers 150 lorsque les coûts réels démontreront un coût moyen inférieur à 0,01 € par interaction.

À 6,99 € vendu en France, après retrait de 20 % de TVA puis 15 % de commission du store, Bible Strong conserve environ **4,95 € par mois et par abonné** avant coût IA, hébergement, support, remboursements et impôt sur les bénéfices.

Avec une hypothèse centrale de **0,01 € par interaction IA complète** :

- 50 interactions coûtent environ 0,50 € ;
- 100 interactions coûtent environ 1 € ;
- 150 interactions coûtent environ 1,50 € ;
- 300 interactions coûtent environ 3 €.

Le coût fixe public de Gloo Pro est de 25 USD/mois, soit environ 21,54 € au taux de change de référence utilisé. Il devient rapidement marginal : 0,22 € par abonné avec 100 abonnés payants et 0,02 € avec 1 000 abonnés.

## Impact des 15 000 utilisateurs quotidiens

Bible Strong compte environ **15 000 utilisateurs actifs par jour**. Un quota gratuit quotidien doit donc être analysé comme une dépense maximale, même si tous les utilisateurs ne le consommeront pas.

| Quota gratuit consommé | Interactions mensuelles maximales | À 0,0013 € sur modèle économique | À 0,008 € en routage équilibré | À 0,01 € en hypothèse centrale premium |
| ---: | ---: | ---: | ---: | ---: |
| 1 par jour | 450 000 | 585 € | 3 600 € | 4 500 € |
| 5 par jour | 2 250 000 | 2 925 € | 18 000 € | 22 500 € |
| 10 par jour | 4 500 000 | 5 850 € | 36 000 € | 45 000 € |

Le scénario économique à 0,0013 € suppose que le gratuit ne passe pas par le même `auto_routing` que le premium : modèle imposé de type GPT-5 Mini, environ 2 000 tokens d'entrée, 400 tokens de sortie, trois sources au maximum, historique très court et environ 1,1 appel Gloo par interaction. Gemini Flash Lite pourrait coûter encore moins, mais sa qualité doit être testée avant d'en faire la porte d'entrée du produit.

**Conclusion : 5 à 10 prompts gratuits par jour pour chaque utilisateur ne sont pas recommandés au lancement.** Le plafond paraît généreux, mais crée une exposition mensuelle de plusieurs milliers d'euros même sur un modèle économique et réduit fortement l'incitation à souscrire.

### Scénarios d'usage réel du gratuit

Tous les utilisateurs n'utiliseront pas l'IA. À 0,0013 € par interaction :

| Adoption quotidienne de l'IA | Usage moyen | Interactions/mois | Coût gratuit estimé |
| ---: | ---: | ---: | ---: |
| 5 % des DAU | 2/jour | 45 000 | 59 € |
| 10 % des DAU | 3/jour | 135 000 | 176 € |
| 20 % des DAU | 3/jour | 270 000 | 351 € |
| 20 % des DAU | 5/jour | 450 000 | 585 € |
| 50 % des DAU | 5/jour | 1 125 000 | 1 463 € |

Ces scénarios montrent que le freemium peut fonctionner si le plafond est un garde-fou et non la consommation moyenne. Il faut néanmoins fixer un budget global mensuel et pouvoir réduire le quota sans mise à jour de l'application.

### Nombre d'abonnés nécessaire pour financer le gratuit

À 6,99 €, un abonné français rapporte environ 4,95 € après TVA et store. Après 100 interactions premium estimées à 1 €, il reste environ **3,95 € de contribution** pour financer le gratuit et la croissance.

| Offre gratuite, consommée par tous les DAU | Coût mensuel économique | Abonnés à 6,99 € nécessaires | Équivalent des 15 000 DAU |
| --- | ---: | ---: | ---: |
| 10 interactions par mois | 195 € | 50 | 0,3 % |
| 1 interaction/jour, maximum 10/mois | 195 € | 50 | 0,3 % |
| 1 interaction par jour sans plafond mensuel | 585 € | 149 | 1,0 % |
| 5 interactions par jour | 2 925 € | 741 | 4,9 % |
| 10 interactions par jour | 5 850 € | 1 482 | 9,9 % |

Ce calcul est volontairement sévère : il suppose que chacun consomme tout son quota. En revanche, il ne comprend encore ni Cloudflare/Neon, ni support, ni acquisition, ni remboursements.

### Freemium recommandé

L'offre de lancement recommandée est :

- **gratuit : 1 interaction IA par jour, plafonnée à 10 interactions par mois** ;
- modèle économique imposé, réponse courte et trois sources maximum ;
- pas de mémoire conversationnelle longue ni d'enchaînement coûteux ;
- un compteur visible qui explique la valeur du premium ;
- **premium à 6,99 € : 100 interactions par mois**, auto-routing qualitatif, réponses plus longues, davantage de sources et conversations suivies ;
- Remote Config côté serveur pour modifier les limites et arrêter le gratuit quand le budget global est atteint.

Une variante plus agressive pour l'acquisition consiste à offrir dix interactions pendant les sept premiers jours, puis une interaction par semaine. Elle donne une vraie démonstration sans créer une dépense quotidienne permanente.

Il est déconseillé d'annoncer « prompts illimités ». Un système de crédits ou de fair use permet de conserver une marge positive et de protéger le service contre les automatisations et comptes multiples.

### Conversion nécessaire

À 6,99 €, 100 interactions premium et 10 interactions gratuites mensuelles maximum pour les 15 000 DAU :

- le coût maximal du gratuit est environ 195 €/mois ;
- Gloo Pro ajoute environ 22 €/mois ;
- environ 55 abonnés couvrent ces deux postes après leur propre usage IA ;
- cela correspond à seulement **0,37 %** des 15 000 utilisateurs quotidiens.

À titre de projection, en prenant les DAU comme base simplifiée :

| Conversion | Abonnés | Recette après TVA/store | Coût premium à 1 €/abonné | Contribution après gratuit maximal et Gloo Pro |
| ---: | ---: | ---: | ---: | ---: |
| 0,5 % | 75 | 371 € | 75 € | 79 € |
| 1 % | 150 | 743 € | 150 € | 376 € |
| 2 % | 300 | 1 485 € | 300 € | 968 € |
| 3 % | 450 | 2 228 € | 450 € | 1 561 € |
| 5 % | 750 | 3 713 € | 750 € | 2 746 € |

Cette table ne mesure pas le chiffre d'affaires total potentiel, car un abonné reste abonné même les jours où il n'ouvre pas l'application et la base mensuelle est probablement supérieure à 15 000. Elle sert seulement à vérifier que le modèle peut être positif à petite échelle.

## Sources tarifaires officielles

- [Gloo Plans](https://studio.ai.gloo.com/plans) : Pro coûte 25 USD/mois plus l'usage et donne accès au Data Engine et à Grounded Completions.
- [Catalogue officiel des modèles Gloo](https://platform.ai.gloo.com/platform/v2/models) : prix d'entrée et de sortie par modèle.
- [Gloo Models](https://studio.ai.gloo.com/models) : les tarifs du catalogue sont des prix catalogue auxquels Gloo ajoute 6,5 %.
- [Grounded Completions](https://docs.gloo.com/api-guides/grounded-completions) : une réponse d'exemple consomme 2 137 tokens d'entrée et 592 tokens de sortie ; les sources récupérées font partie du contexte facturé au modèle.
- [Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/) et [abonnements Apple](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/) : commission de 15 % pour les membres éligibles, soit 85 % des recettes moins les taxes applicables dès le premier jour.
- [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622) : 15 % sur les abonnements à renouvellement automatique.
- [Google Play VAT](https://support.google.com/googleplay/android-developer/answer/138000) : les prix français sont TTC et les frais sont calculés sur le prix hors taxe.
- [Apple proceeds](https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds) : le produit net est le prix client moins taxes applicables et commission Apple.
- [Taux BCE EUR/USD](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) : 1 EUR = 1,1605 USD le 19 août 2026.

Gloo ne publie pas de tarif unitaire séparé pour le retrieval de Grounded Completions. Le calcul suppose donc le prix public Pro plus les tokens. Ce point doit être confirmé commercialement avant lancement.

## Hypothèse d'une interaction Bible Strong

Une interaction standard est modélisée avec :

- 3 000 tokens d'entrée : prompt, question, historique borné, outils et extraits RAG ;
- 800 tokens de sortie ;
- un facteur de 1,3 appel par interaction pour couvrir les interactions qui nécessitent un appel d'outil puis une seconde génération ;
- la majoration Gloo de 6,5 % ;
- conversion USD/EUR au taux BCE indiqué.

Cette hypothèse est plus prudente que l'exemple Gloo de 2 137 tokens d'entrée et 592 tokens de sortie. Une conversation dont l'historique croît sans limite coûtera davantage ; le produit doit donc borner l'historique envoyé et la longueur de réponse.

## Coût estimé par interaction selon le modèle

| Modèle Gloo | Entrée USD/1M | Sortie USD/1M | Coût estimé par interaction |
| --- | ---: | ---: | ---: |
| Gemini 2.5 Flash Lite | 0,10 $ | 0,40 $ | 0,0007 € |
| GPT-5 Mini | 0,25 $ | 2,00 $ | 0,0028 € |
| Claude Haiku 4.5 | 1,00 $ | 5,00 $ | 0,0084 € |
| Claude Sonnet 5 | 2,00 $ | 10,00 $ | 0,0167 € |
| Claude Sonnet 4.6 | 3,00 $ | 15,00 $ | 0,0251 € |
| Claude Opus, tarif 5/25 | 5,00 $ | 25,00 $ | 0,0418 € |

Les montants comprennent le facteur de 1,3 appel et la majoration Gloo. Ils n'intègrent pas une éventuelle facturation contractuelle supplémentaire du Data Engine.

Deux mélanges donnent un ordre de grandeur utile :

- routage équilibré entre modèles économiques et puissants : environ **0,008 € par interaction** ;
- routage orienté qualité avec davantage de Sonnet/Opus : environ **0,017 € par interaction**.

Le budget doit donc être construit sur **0,01 € par interaction** en scénario central et **0,02 €** en scénario prudent tant que la distribution réelle d'`auto_routing` n'est pas connue.

## Recette nette par abonnement en France

Formule prudente :

```text
recette nette = prix public / 1,20 de TVA × 0,85 après store
```

| Prix public mensuel | Après 15 % seulement | Après TVA française puis 15 % | Budget IA à 20 % de la recette nette |
| ---: | ---: | ---: | ---: |
| 3,99 € | 3,39 € | **2,83 €** | 0,57 € |
| 4,99 € | 4,24 € | **3,53 €** | 0,71 € |
| 6,99 € | 5,94 € | **4,95 €** | 0,99 € |

La colonne à utiliser pour une base d'utilisateurs principalement française est celle à 2,83 €, 3,53 € et 4,95 €. Les recettes exactes varieront selon le pays, les taxes, les paliers locaux et les ajustements des stores.

## Marge à 100 abonnés payants

Cette table utilise :

- coût fixe Gloo Pro réparti : 21,54 €/100 = 0,22 € par abonné ;
- coût moyen : 0,01 € par interaction ;
- marge calculée après TVA, store, coût fixe Gloo et tokens, mais avant autres frais et impôts.

| Prix | 50 interactions | Marge | 100 interactions | Marge | 150 interactions | Marge |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3,99 € | 2,11 € | 75 % | 1,61 € | 57 % | 1,11 € | 39 % |
| 4,99 € | 2,82 € | 80 % | 2,32 € | 66 % | 1,82 € | 51 % |
| 6,99 € | 4,24 € | 86 % | 3,74 € | 75 % | 3,24 € | 65 % |

À 1 000 abonnés, la part du forfait Pro tombe à environ 0,02 € par personne et les marges gagnent approximativement quatre points par rapport à cette table.

## Lecture des trois prix

### 3,99 €/mois

Viable pour un produit léger, environ 40 à 50 interactions mensuelles. Ce tarif est fragile pour les utilisateurs intensifs et laisse moins de budget pour le support, l'acquisition, les remboursements et le développement. Il convient mieux à une offre d'entrée ou au prix mensuel effectif d'un abonnement annuel.

### 4,99 €/mois

Viable avec 80 à 100 interactions mensuelles et un routage équilibré. C'est un bon prix de lancement orienté conversion, mais pas celui qui offre le plus de capacité de croissance.

### 6,99 €/mois

Meilleur compromis économique. À 100 interactions, la marge contributive estimée reste voisine de 75 % dans le scénario central à 100 abonnés. Ce prix absorbe beaucoup mieux les gros utilisateurs, les fluctuations de modèles et le coût d'acquisition.

## Offre recommandée

### Bible Strong IA

- **6,99 €/mois** ;
- **69,99 €/an**, soit environ 5,83 €/mois avant taxes et commissions ;
- éventuellement **59,99 €/an** comme offre fondateur limitée dans le temps ;
- 7 jours d'essai avec 10 interactions IA maximum, ou aucun essai gratuit au tout début ;
- environ **100 interactions génératives par mois au lancement** ;
- enrichissements publics déjà générés et mis en cache non décomptés ;
- réponses courtes, historiques bornés et maximum de sources contrôlé ;
- pas de report des interactions inutilisées ;
- top-ups éventuels seulement après observation des usages.

Le mot « interaction » doit correspondre à une action compréhensible : poser une question, approfondir un chapitre, expliquer un Strong ou lancer une recherche IA. Les appels techniques internes nécessaires à une seule réponse ne doivent pas être visibles ni facturés plusieurs fois à l'utilisateur.

Lorsque la télémétrie montre pendant plusieurs mois que le coût p95 reste sous 0,01 €, le quota pourra passer à 150. S'il dépasse 0,02 €, il faudra réduire la longueur des réponses, borner davantage l'historique ou utiliser un routage moins coûteux avant de modifier le prix.

## Exemple de croissance

Avec 1 000 abonnés à 6,99 € en France :

- chiffre d'affaires client : 6 990 €/mois ;
- recette estimée après TVA et 15 % de store : environ 4 951 € ;
- 100 interactions par abonné à 0,01 € : environ 1 000 € ;
- Gloo Pro : environ 22 € ;
- contribution restante : environ **3 929 €/mois** avant Cloudflare/Neon, support, marketing, remboursements et impôts.

Avec seulement 50 interactions moyennes par abonné, la contribution monte à environ 4 429 €. La moyenne réelle sera probablement très inférieure au quota pour une part des abonnés, mais la décision financière ne doit pas dépendre de cette hypothèse avant d'avoir des données réelles.

## Métriques obligatoires dès le POC

Enregistrer sans contenu spirituel brut :

- modèle réellement sélectionné ;
- tokens d'entrée, de sortie et de cache ;
- nombre d'appels Gloo par interaction utilisateur ;
- coût Gloo calculé par interaction ;
- route produit : chapitre, Strong, recherche ou chat ;
- p50, p95 et p99 du coût par interaction ;
- interactions mensuelles par abonné ;
- pourcentage d'abonnés atteignant 50 %, 80 % et 100 % du quota ;
- marge par cohorte iOS/Android, pays et formule mensuelle/annuelle.

Après quatre à huit semaines de POC, ces données permettront de remplacer l'hypothèse de 0,01 € par le coût réel et de fixer définitivement quota, annuel et éventuels packs supplémentaires.

# Onboarding mobile d’une application riche en fonctionnalités — état des pratiques 2025–2026

Date de recherche : 6 août 2026

## Question étudiée

Comment concevoir l’onboarding de Bible Strong, application mobile gratuite et riche en fonctionnalités, pour faire découvrir rapidement sa valeur sans imposer un long tutoriel, tout en préparant une future offre premium centrée sur l’IA ?

Cette note confronte les recommandations officielles Apple, Android et W3C à des données first-party d’Amplitude. Les propositions propres à Bible Strong sont des déductions produit, pas des prescriptions de ces sources.

## Conclusion

Il n’existe pas de nombre universel de pages d’onboarding recommandé par les plateformes. Apple demande un flux « rapide, amusant et facultatif » et recommande les conseils contextuels ; Android recommande de séparer ce qui est indispensable avant l’usage de ce qui peut être appris en contexte, puis de fractionner les parcours longs en petites étapes. La meilleure structure pour Bible Strong est donc :

- un **onboarding initial de 3 écrans maximum**, skippable et sans compte obligatoire ;
- une **micro-personnalisation facultative par intention**, sans enfermer l’utilisateur dans un profil ;
- une **première interaction réelle et sûre** qui conduit du verset au sens d’un mot ;
- puis un **onboarding progressif** déclenché au moment où une fonctionnalité devient pertinente.

Le premier onboarding ne doit pas inventorier les dizaines de fonctions. Il doit faire vivre une promesse mémorable : **« Partir d’un verset, comprendre ses mots, puis relier ses découvertes. »** Le lexique hébreu/grec est le meilleur premier « moment de valeur » car il est immédiatement démontrable. Les Relations sont le second pilier différenciant : elles expriment la profondeur du produit, mais demandent plus de contexte pour être comprises.

## 1. Les principes qui font consensus

### Faire expérimenter la valeur, pas montrer un catalogue

Apple recommande explicitement d’enseigner par l’interaction, car effectuer une tâche est plus facile à comprendre et à retenir que regarder une explication. Apple recommande également de placer une instruction près de la zone de l’interface concernée et d’envisager une collection de conseils contextuels plutôt qu’un tutoriel unique. Android décrit l’onboarding « just-in-time » comme un moyen de fractionner l’éducation en étapes plus petites, mémorables et gérables, et d’apprendre en faisant.

Conséquence pour Bible Strong : une animation montrant successivement 40 traductions, les plans, les notes, l’audio, la timeline et les outils d’étude créerait de la notoriété, mais pas de compétence ni de valeur vécue. Le premier parcours doit faire accomplir une action représentative.

Sources : [Apple HIG — Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding), [Android — Authentication & Onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding).

### Laisser entrer immédiatement dans l’application

Apple demande que l’onboarding soit facultatif, recommande de reporter la configuration non essentielle et de fournir de bons réglages par défaut. Android recommande de ne collecter que les informations critiques et d’éviter les longs formulaires.

Conséquence : « Passer » doit être visible dès le premier écran ; aucun compte, téléchargement lourd, choix exhaustif de ressources ou autorisation système ne doit bloquer l’accès au lecteur. Le flux doit être relançable depuis Aide ou Réglages.

Sources : [Apple HIG — Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding), [Android — Authentication & Onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding).

### Personnaliser légèrement, sans taxonomie de personnes

La distinction « utilisateur simple » / « théologien » est fragile : une même personne peut vouloir lire rapidement le matin et étudier un terme grec le soir. Une question facultative sur l’intention est plus utile et moins stigmatisante :

- **Lire simplement** ;
- **Comprendre les mots** ;
- **Étudier en profondeur**.

Ce choix ne doit ni masquer ni verrouiller des fonctions. Il sert uniquement à choisir le premier exemple, l’ordre des conseils contextuels et éventuellement la page d’accueil. Un réglage par défaut doit fonctionner si la personne ignore la question. Cette recommandation est une déduction de la demande Apple de reporter la personnalisation non essentielle et de la recommandation Android de ne collecter que l’information critique.

### Construire l’onboarding comme un système continu

L’onboarding n’est pas terminé quand le carrousel est fermé. Android recommande les infobulles riches, feuilles et dialogues pour la découverte en contexte. Pour Bible Strong, les déclencheurs pourraient être :

| Moment réel | Conseil contextuel unique |
|---|---|
| Première sélection d’un verset | Surligner, noter ou étudier |
| Premier mot Strong ouvert | Concordance, occurrences et langue originale |
| Première seconde entité consultée | Découvrir les Relations |
| Première note créée | Relier la note à un verset ou à une entrée Strong |
| Première ressource indisponible hors ligne | Télécharger pour l’usage hors connexion |
| Plusieurs contextes d’étude ouverts | Présenter les onglets/groupes |

Chaque conseil doit être dismissible, ne pas réapparaître après rejet et rester consultable dans une aide « Découvrir Bible Strong ».

Source : [Android — Authentication & Onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding), [Apple HIG — Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding).

## 2. Parcours initial recommandé pour Bible Strong

### Écran 1 — La promesse et l’intention

Promesse courte : **« La Bible, du texte au sens. »**

Une animation peut faire apparaître un verset, puis révéler discrètement qu’un mot possède une profondeur originale. Les trois intentions ci-dessus sont proposées sous forme de choix facultatif ; le CTA principal reste « Commencer » et « Passer » est immédiatement visible.

### Écran 2 — Le moment de valeur interactif

Présenter un vrai verset court et inviter la personne à toucher un mot signalé. Le toucher révèle une carte compacte : terme hébreu ou grec, translittération, sens principal et occurrences. La personne apprend ainsi le geste central en obtenant une information authentique.

Cette étape doit être une interaction réversible, fonctionner sans téléchargement et proposer un bouton explicite en plus du geste. Elle établit la première différence concrète entre Bible Strong et un simple lecteur biblique.

### Écran 3 — De la découverte à l’étude personnelle

Faire évoluer visuellement la carte du mot vers un petit réseau : verset ↔ entrée Strong ↔ note ou thème. Le CTA ouvre ensuite un passage réel dans le lecteur. Le message porte sur le bénéfice — **« Gardez et reliez ce que vous découvrez »** — plutôt que sur le modèle de données.

Les Relations ne remplacent donc pas le lexique comme premier « aha moment » ; elles en sont l’amplificateur. Le lexique prouve la profondeur éditoriale, les Relations montrent que cette profondeur peut devenir un espace d’étude personnel.

### Pourquoi trois écrans

« Trois » est ici une hypothèse de conception testable, pas une norme : un écran pour orienter, un pour faire vivre la valeur, un pour transférer vers l’application. Ajouter davantage d’écrans contredirait l’objectif de rapidité et repousserait l’usage réel. Si l’interaction du deuxième écran rend le flux trop long ou fragile, la variante de contrôle doit être un parcours de deux écrans suivi d’un guide contextuel dans le vrai lecteur.

## 3. Permissions et compte

Apple recommande d’intégrer une permission à l’onboarding seulement si l’application ne peut pas fonctionner sans elle ; sinon, il faut la demander au premier usage de la fonction concernée. Android demande explicitement de solliciter les permissions en contexte, de permettre l’annulation de l’explication et de dégrader élégamment la fonction en cas de refus.

Pour Bible Strong :

- ne demander **aucune permission système** dans le carrousel initial ;
- demander les notifications seulement après que l’utilisateur choisit un rappel de lecture ou de verset ;
- demander le microphone seulement après une action explicite sur une éventuelle entrée vocale IA ;
- expliquer juste avant la boîte système le bénéfice, la donnée concernée et ce qui restera possible en cas de refus ;
- ne pas demander la création d’un compte avant le premier moment de valeur ; présenter le compte quand la synchronisation ou la sauvegarde apporte un bénéfice compréhensible.

Sources : [Apple HIG — Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding), [Apple HIG — Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy), [Android — Request runtime permissions](https://developer.android.com/training/permissions/requesting), [Android — Permissions overview](https://developer.android.com/guide/topics/permissions/overview).

## 4. Animation et accessibilité

L’animation doit enseigner une relation causale — toucher un mot révèle son origine, relier deux éléments crée un chemin — plutôt que retarder le CTA. Elle doit rester pilotée par l’utilisateur et ne jamais être le seul moyen de comprendre ou d’agir.

Exigences de conception :

- respecter le réglage système **Réduire les animations** ; remplacer parallaxe, zoom, rotation, profondeur et grands déplacements par des fondus ou changements instantanés ;
- ne pas lancer de mouvement décoratif continu ; tout contenu animé automatiquement pendant plus de cinq secondes et affiché avec d’autres contenus doit pouvoir être mis en pause, arrêté ou masqué selon WCAG 2.2 ;
- ne jamais dépendre d’un glissement, drag ou mouvement de l’appareil : fournir un bouton ou une action accessible équivalente ;
- donner des labels et états lisibles par VoiceOver/TalkBack, annoncer les changements de statut utiles sans déplacer inutilement le focus ;
- supporter le texte agrandi et le reflow ; ne pas figer une hauteur d’écran autour de l’illustration ;
- viser des zones tactiles de **44 × 44 pt sur iOS** et **48 dp sur Android**, avec suffisamment d’espace ;
- conserver le sens sans dépendre uniquement de la couleur et vérifier les contrastes en modes clair et sombre.

Apple précise que Reduce Motion doit réduire les animations automatiques et répétitives et recommande notamment de remplacer les translations par des fondus. WCAG 2.2 exige une alternative aux interactions déclenchées par le mouvement et rend désactivable l’animation provoquée par une interaction (niveau AAA). Android exige une alternative aux gestes pour les flux essentiels.

Sources : [Apple HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Apple — Reduced Motion evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria), [Android — Accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [W3C — Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), [W3C — Motion Actuation](https://www.w3.org/WAI/WCAG22/Understanding/motion-actuation.html), [W3C — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

## 5. Mesurer l’activation plutôt que la fin du carrousel

La complétion de l’onboarding est un indicateur de friction, pas une preuve de valeur. Amplitude définit dans son rapport 2025 l’activation comme le retour d’un nouvel utilisateur un jour donné après sa première visite, tout en recommandant de distinguer une simple ouverture d’une action alignée sur la proposition de valeur. Son analyse anonymisée porte sur plus de 2 600 entreprises, 10 600 produits et la période septembre 2023–septembre 2024 ; elle observe une association entre activation précoce et rétention, sans établir qu’un design d’onboarding particulier cause la rétention. Ces benchmarks, multi-industries, ne doivent donc pas devenir des objectifs copiés tels quels pour Bible Strong.

### Définition proposée

Définir un événement d’activation propre à Bible Strong, atteint quand une personne effectue dans ses premières sessions au moins une boucle de valeur :

1. ouvre un passage ;
2. approfondit ce passage en ouvrant une entrée Strong, une comparaison ou une Relation ;
3. facultativement conserve le résultat par une note, un surlignage, un signet ou une Relation.

Séparer :

- **activation de découverte** : passage → ressource d’étude ;
- **activation d’appropriation** : découverte → objet personnel enregistré ;
- **rétention** : retour à J1, J7 et J30 avec une action d’étude significative, pas seulement un lancement.

### Événements minimaux

`onboarding_started`, `onboarding_intent_selected`, `onboarding_step_viewed`, `onboarding_skipped`, `onboarding_completed`, `first_passage_opened`, `first_word_tapped`, `first_strong_opened`, `first_relation_opened`, `first_personal_object_created`, `contextual_tip_shown`, `contextual_tip_used`, `contextual_tip_dismissed`.

Mesurer le temps jusqu’au premier passage et jusqu’au premier événement de valeur, les abandons par étape, l’activation par intention choisie, puis les cohortes J1/J7/J30. A/B tester une hypothèse précise à la fois : deux ou trois écrans, démonstration simulée ou directement dans le lecteur, question d’intention avant ou après la démonstration. Ne pas optimiser le taux de complétion au détriment de l’activation réelle.

Source : [Amplitude — Product Benchmark Report 2025 (PDF)](https://info.amplitude.com/rs/138-CDN-550/images/the-product-benchmark-report.pdf), notamment les pages 3, 10–14 et 29 pour les définitions, résultats et méthode.

## 6. Préparer une future offre IA premium sans dark patterns

### Ne pas vendre une fonction indisponible dans l’onboarding actuel

Si l’IA n’est pas encore utilisable, elle ne doit pas être l’une des trois promesses principales. Une mention « bientôt » n’est justifiée que si elle est précise, non bloquante et sans CTA d’achat. Le meilleur investissement aujourd’hui est de réserver dans l’architecture d’onboarding des emplacements et déclencheurs contextuels, pas de faire de l’IA une fausse étape d’activation.

### Quand l’IA sera disponible

Introduire la fonction au moment où elle peut aider sur une tâche réelle, avec un exemple à faible risque et réversible. Décrire son bénéfice, ses limites et le fait qu’il s’agit d’une IA ; prévoir une voie non-IA lorsque le modèle échoue. Le guide PAIR de Google recommande d’introduire l’IA par étapes, de ne présenter les fonctions que lorsqu’elles sont utiles, d’éviter les promesses de « magie », de clarifier capacités et limites et de fournir une issue manuelle en cas d’échec.

Pour une application d’étude biblique, l’interface doit aussi distinguer clairement :

- le **contenu éditorial sourcé** (texte biblique, lexiques, concordances) ;
- la **synthèse générée par IA**, potentiellement incorrecte ;
- les **sources utilisées** et la possibilité d’ouvrir le passage ou la ressource d’origine ;
- ce qui est envoyé au serveur, conservé ou utilisé pour l’amélioration du modèle.

Apple demande d’identifier clairement l’usage de l’IA, de minimiser les données envoyées au serveur, d’indiquer ce qui est partagé et stocké hors appareil, et d’obtenir l’autorisation avant d’utiliser des données personnelles ou d’usage. Le consentement à l’analyse IA ne doit pas être fusionné avec l’achat Premium.

Sources : [Apple HIG — Generative AI](https://developer.apple.com/design/human-interface-guidelines/generative-ai), [Google PAIR — Mental Models](https://pair.withgoogle.com/guidebook-v2/chapter/mental-models/), [Google PAIR — Explainability + Trust](https://pair.withgoogle.com/guidebook-v2/chapter/explainability-trust/), [Google PAIR — Errors + Graceful Failure](https://pair.withgoogle.com/guidebook-v2/chapter/errors-failing/), [Google PAIR — Feedback + Control](https://pair.withgoogle.com/guidebook-v2/chapter/feedback-controls/).

### Paywall honnête, après valeur vécue

Apple recommande de laisser la personne expérimenter l’application avant une demande d’achat. Apple exige qu’avant l’abonnement l’application décrive clairement ce que la personne reçoit pour le prix et que l’abonnement apporte une valeur continue. Google Play interdit les expériences d’achat trompeuses ou manipulatrices et exige d’afficher clairement coût, fréquence, renouvellement automatique, durée et conversion d’un essai, ainsi qu’un moyen évident de fermer l’offre et de gérer ou annuler l’abonnement.

Le futur paywall IA devrait donc :

- apparaître après une intention explicite d’utiliser une fonction IA, pas au premier lancement ;
- laisser la valeur gratuite actuelle clairement accessible ;
- montrer le prix réellement facturé et sa période plus visiblement qu’un équivalent mensuel calculé ;
- détailler les limites d’usage ou crédits, les fonctions incluses, le renouvellement et la fin de l’essai ;
- avoir une fermeture visible, une restauration d’achat et un accès simple à la gestion de l’abonnement ;
- éviter compte à rebours artificiel, option présélectionnée ambiguë, faux bouton de fermeture, répétition du paywall et promesse d’infaillibilité théologique.

Sources : [Apple App Review Guidelines, sections 3.1.2 et 5.6](https://developer.apple.com/app-store/review/guidelines/), [Google Play — Subscriptions policy](https://support.google.com/googleplay/android-developer/answer/9900533).

## 7. Ordre de validation recommandé

1. Tester qualitativement la promesse et le prototype interactif avec des personnes ayant des niveaux d’étude biblique différents.
2. Vérifier qu’elles peuvent expliquer, sans reprendre les mots de l’interface, ce que Bible Strong leur permet de faire.
3. Livrer une première version instrumentée avec trois écrans maximum et quelques conseils contextuels.
4. Vérifier accessibilité et Reduce Motion avant d’ajouter davantage d’effets.
5. Observer activation et rétention par cohorte avant d’ajouter une quatrième étape.
6. Concevoir l’onboarding IA et son paywall comme un parcours distinct seulement lorsque la fonction est réellement disponible.

## Sources principales

- [Apple Human Interface Guidelines — Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)
- [Apple Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple Human Interface Guidelines — Generative AI](https://developer.apple.com/design/human-interface-guidelines/generative-ai)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Android Design — Authentication & Onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding)
- [Android Developers — Request runtime permissions](https://developer.android.com/training/permissions/requesting)
- [Android Design — Accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility)
- [W3C — Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [Google PAIR — People + AI Guidebook](https://pair.withgoogle.com/guidebook-v2/chapters)
- [Google Play — Subscriptions policy](https://support.google.com/googleplay/android-developer/answer/9900533)
- [Amplitude — Product Benchmark Report 2025](https://info.amplitude.com/rs/138-CDN-550/images/the-product-benchmark-report.pdf)

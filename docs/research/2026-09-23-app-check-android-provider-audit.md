# Audit des fournisseurs App Check Android

Recherche effectuée le 23 septembre 2026. Sources primaires uniquement. Aucun réglage de production modifié et aucun essai sur les appareils des utilisateurs effectué.

## Conclusion proposée

**Ne pas considérer les sessions signées maison comme la prochaine étape obligatoire.** Tester d'abord si un autre fournisseur peut délivrer un jeton App Check utilisable par les Android actuellement exclus. Cela préserve le contrat d'accès existant. reCAPTCHA Enterprise natif Android est une piste concrète, mais son efficacité sur ces appareils reste à mesurer : ce n'est pas une solution validée à ce stade.

App Check délivre déjà des jetons temporaires, mis en cache puis renouvelés. La question non résolue est la preuve demandée avant de les délivrer. Firebase précise aussi qu'App Check réduit certains abus sans les supprimer tous. Un nouveau format de jeton ne change pas cette limite. [Fonctionnement et garanties d'App Check](https://firebase.google.com/docs/app-check)

Le choix entre fournisseur App Check et sessions propres dépend aussi du périmètre voulu : changer le fournisseur d'un App ID affecte tous les backends qui font confiance aux jetons de cet App ID. Une politique de secours limitée aux ressources de lecture peut nécessiter une frontière distincte. C'est une décision d'architecture à prendre avant le pilote de production.

## reCAPTCHA Enterprise natif : disponibilité réelle

Le fournisseur Android est en **Preview**, sans SLA ni garantie de stabilité de cette fonctionnalité. Firebase demande **BoM 34.17.0 minimum**, une clé de type Android et `firebase-appcheck-recaptcha`. La documentation présente actuellement la version **19.2.1** de cette bibliothèque. Le contrôle est invisible et fondé sur un score ; il ne propose pas de challenge interactif de secours. [Guide Android Firebase](https://firebase.google.com/docs/app-check/android/recaptcha-enterprise-provider)

La configuration REST accepte un seuil minimal de score, **0.5 par défaut**, et un TTL entre **30 minutes et 7 jours**, une heure par défaut. Un score inférieur au seuil est refusé. Il faut donc mesurer les faux refus sur notre population avant de retenir ce fournisseur. [Configuration reCAPTCHA Enterprise App Check](https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.recaptchaEnterpriseConfig)

Firebase classe Google Play services comme **recommandés** pour ce fournisseur, contre **obligatoires** pour Play Integrity. Cela justifie un essai sur des appareils sans environnement Google complet ; cela ne garantit pas un score acceptable. [Dépendances Firebase à Google Play services](https://firebase.google.com/docs/android/android-play-services)

### Android 9, dépendances et durée de vie

Les artefacts officiels Maven inspectés donnent :

| Artefact                             | Observation                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `firebase-appcheck-recaptcha:19.2.1` | Manifest `minSdkVersion=23` ; dépend de `firebase-appcheck:19.4.1` et de `recaptcha:18.7.1` |
| `recaptcha:18.7.1`                   | Manifest `minSdkVersion=21`                                                                 |
| `recaptcha:18.9.3`                   | Manifest `minSdkVersion=24`                                                                 |

Android 9, API 28, satisfait donc ces minima. Il faudra encore vérifier le graphe effectivement résolu au build. Sources : [POM App Check 19.2.1](https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-appcheck-recaptcha/19.2.1/firebase-appcheck-recaptcha-19.2.1.pom), manifests inclus dans les [AAR App Check](https://dl.google.com/dl/android/maven2/com/google/firebase/firebase-appcheck-recaptcha/19.2.1/firebase-appcheck-recaptcha-19.2.1.aar), [reCAPTCHA 18.7.1](https://dl.google.com/dl/android/maven2/com/google/android/recaptcha/recaptcha/18.7.1/recaptcha-18.7.1.aar) et [reCAPTCHA 18.9.3](https://dl.google.com/dl/android/maven2/com/google/android/recaptcha/recaptcha/18.9.3/recaptcha-18.9.3.aar).

La documentation d'intégration générique indique encore API 23, tandis que les notes de version de reCAPTCHA 18.9 annoncent API 24. Pour les minima exacts, retenir les versions résolues et leur manifest, pas une généralité sur « reCAPTCHA ». [Guide Android](https://docs.cloud.google.com/recaptcha/docs/instrument-android-apps), [notes de version](https://docs.cloud.google.com/recaptcha/docs/release-notes)

Les versions mobiles peuvent être **arrêtées côté Google**, y compris dans des applications déjà installées. Le calendrier annonce l'arrêt de la famille 18.7 en **T3 2028**, de 18.9 en **T3 2029**. Une app durablement non mise à jour peut donc perdre ce mécanisme. Il faut prévoir des mises à jour natives régulières et une politique pour ces anciens clients. [Calendrier de dépréciation et d'arrêt](https://docs.cloud.google.com/recaptcha/docs/deprecation-policy-mobile)

### Le fournisseur n'est pas entièrement indépendant de Play

Les POM reCAPTCHA **18.7.1 et 18.9.3** incluent `com.google.android.play:integrity:1.4.0` et `play-services-recaptchabase`. Cela prouve une dépendance logicielle, **pas** l'exigence systématique de `MEETS_DEVICE_INTEGRITY` ou de `PLAY_RECOGNIZED`. Les documents consultés n'explicitent pas tous les signaux ni leur pondération. Ne pas promettre que changer de fournisseur éliminera tout effet des signaux Play. [POM 18.7.1](https://dl.google.com/dl/android/maven2/com/google/android/recaptcha/recaptcha/18.7.1/recaptcha-18.7.1.pom), [POM 18.9.3](https://dl.google.com/dl/android/maven2/com/google/android/recaptcha/recaptcha/18.9.3/recaptcha-18.9.3.pom)

La clé Android dispose précisément de **`supportNonGoogleAppStoreDistribution`**, présenté dans la console comme « Support applications distributed outside of the Google Play Store ». Google demande de l'activer pour une distribution également hors Play, en conservant la vérification du nom du package. Le pilote doit couvrir les APK distribués hors Play avec ce réglage. [Création des clés mobiles](https://docs.cloud.google.com/recaptcha/docs/create-key-mobile), [référence AndroidKeySettings](https://docs.cloud.google.com/java/docs/reference/google-cloud-recaptchaenterprise/latest/com.google.recaptchaenterprise.v1.AndroidKeySettings.Builder)

## Intégration React Native : un développement natif

Le dépôt utilise `@react-native-firebase/*` **23.7.0** dans [apps/expo/package.json](../../apps/expo/package.json). Dans les dépendances locales inspectées, cette version annonce le BoM **34.6.0**. Le type Android et le bridge Java ne prennent en charge que **`debug` et `playIntegrity`** ; le Gradle App Check n'ajoute pas la bibliothèque reCAPTCHA. Le fichier Java de la branche officielle actuelle garde cette même liste. [Provider officiel React Native Firebase](https://github.com/invertase/react-native-firebase/blob/main/packages/app-check/android/src/main/java/io/invertase/firebase/appcheck/ReactNativeFirebaseAppCheckProvider.java)

Conséquence : modifier Firebase Console ou publier seulement du JavaScript OTA ne suffit pas. Il faut une intégration native, un BoM compatible, un build distribué, et des tests sur les autres services Firebase concernés par le changement de dépendances. La forme précise du bridge reste à concevoir ; ne pas annoncer qu'une simple mise à jour RNFirebase suffit.

Google propose aussi un [SDK React Native reCAPTCHA direct](https://github.com/GoogleCloudPlatform/recaptcha-enterprise-react-native), référencé par son guide Android. Il fournit des jetons reCAPTCHA, pas automatiquement l'intégration au fournisseur natif Firebase App Check. Il peut servir à un parcours direct/custom, mais ne dispense pas de l'évaluation serveur et de la gestion du contrat App Check.

## Coexistence et fallback

Play Integrity et reCAPTCHA ont des **configurations REST distinctes rattachées au même App ID**. Le CLI Firebase modélise explicitement plusieurs fournisseurs pour une app Android et modifie seulement la ressource du fournisseur demandé. L'enregistrement reCAPTCHA n'exige donc pas de remplacer la configuration Play Integrity. Cette coexistence doit néanmoins être vérifiée avec de vrais jetons des anciennes et nouvelles versions avant déploiement. [Code CLI des fournisseurs](https://github.com/firebase/firebase-tools/blob/a050d0fed1c6f251c62c41d21af046b70d34a8bc/src/appcheck/providers.ts), [appels REST du CLI](https://github.com/firebase/firebase-tools/blob/a050d0fed1c6f251c62c41d21af046b70d34a8bc/src/appcheck/api.ts)

Côté SDK Android, installer une `AppCheckProviderFactory` **remplace** celle associée à l'instance. Enregistrer plusieurs fournisseurs dans la console ne construit pas un fallback automatique Play Integrity → reCAPTCHA. [Référence FirebaseAppCheck](<https://firebase.google.com/docs/reference/android/com/google/firebase/appcheck/FirebaseAppCheck#installAppCheckProviderFactory(com.google.firebase.appcheck.AppCheckProviderFactory)>)

Le [fournisseur reCAPTCHA officiel](https://github.com/firebase/firebase-android-sdk/blob/281cf3698fea4d8738ea17d0c88321a0ccf2467b/appcheck/firebase-appcheck-recaptcha/src/main/java/com/google/firebase/appcheck/recaptcha/internal/RecaptchaAppCheckProvider.java) acquiert un jeton reCAPTCHA puis l'échange auprès de Firebase ; il n'orchestre pas de fallback Play Integrity. Un éventuel fournisseur composite serait du code propre à concevoir et tester : acquittement des erreurs, concurrence, cache, renouvellement, temporisation et absence de boucles.

**Recommandation pour le premier essai : sélectionner un fournisseur par cohorte/build plutôt que développer immédiatement ce composite.** On mesure ainsi si reCAPTCHA résout les cas visés sans mélanger le résultat avec des erreurs d'orchestration. C'est une recommandation d'audit, pas une capacité automatique du SDK.

### Le périmètre de confiance dépasse le Resource service

Le contrat public `DecodedAppCheckToken` expose `sub`/`app_id`, `aud`, `iss`, `iat`, `exp`. Il ne fournit pas de claim documenté identifiant le fournisseur, le score reCAPTCHA, un niveau d'intégrité, une session utilisateur ou une installation durable. La documentation générale dit seulement que le jeton peut conserver certaines informations d'attestation ; on ne doit pas fonder notre politique sur d'éventuels claims non documentés. [Contrat des claims](https://firebase.google.com/docs/reference/admin/node/firebase-admin.app-check.decodedappchecktoken), [vérification d'un backend personnalisé](https://firebase.google.com/docs/app-check/custom-resource-backend)

**Inférence architecturale :** si Play Integrity et reCAPTCHA délivrent pour le même App ID, les backends vérifiant seulement ce contrat les accepteront selon la même politique. Cela inclut tout backend externe utilisant ces jetons, notamment l'assistant si son intégration partage cet App ID. Un header client `provider=playIntegrity` ne crée pas de distinction fiable. Un pilote utilisant l'App ID de production doit donc être évalué à l'échelle de tous ses consommateurs ; une variante App ID/projet isolée ou un contrat de secours propre au Resource service peut être préférable si les niveaux de confiance doivent différer.

## Play Integrity, Basic et sideload : corriger les certitudes

Lors de l'audit principal, la console de production a été relue : `PLAY_RECOGNIZED` requis, `LICENSED` non requis, aucune exigence explicite de niveau d'intégrité, TTL d'une heure. reCAPTCHA natif est proposé en Preview mais n'est pas enregistré. Le réglage Firebase minimal du tableau ci-dessous est donc déjà celui utilisé ; le corriger ne constitue pas une nouvelle solution.

Le tableau Firebase recommande, pour une distribution **Play et hors Play**, `PLAY_RECOGNIZED` requis, `LICENSED` non requis et aucune exigence explicite de niveau d'intégrité. Il avertit que d'autres verdicts peuvent néanmoins effectuer des contrôles implicites. Exiger Basic dans Firebase n'est donc pas plus permissif que le réglage « ne pas vérifier explicitement ». L'activation de Basic dans Play Console rend disponible un verdict facultatif. L'avertissement sur les installations hors Play Android 13+ reste applicable lorsque ce niveau est requis. [Réglages Firebase Play Integrity](https://firebase.google.com/docs/app-check/android/play-integrity-provider)

Il existe une **ambiguïté documentaire à conserver dans le diagnostic** : la référence REST dit que `allowUnrecognizedVersion=true` doit être utilisé pour les apps publiées hors Play, alors que le tableau du guide recommande de conserver `PLAY_RECOGNIZED` pour le cas mixte. `true` accepte aussi `UNEVALUATED`, pas seulement les APK légitimes non reconnus. Ne pas assimiler cette case à « autoriser seulement le sideload officiel ». [Référence PlayIntegrityConfig](https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.playIntegrityConfig)

Le verdict `PLAY_RECOGNIZED` exige une application et un certificat correspondant aux versions distribuées par Play. Une copie du même APK et un APK construit/signé autrement ne sont donc pas des cas équivalents. `UNEVALUATED` peut résulter d'un appareil insuffisamment fiable. Un appareil non rooté selon Sentry ne suffit pas à exclure cette cause. Basic peut accepter des appareils non certifiés ; sur Android 13+, une racine d'attestation Google reste requise. [Définition officielle des verdicts](https://developer.android.com/google/play/integrity/verdicts)

**Contre-hypothèse sans migration : décocher seulement `PLAY_RECOGNIZED`.** Le paramètre est supporté et pourrait débloquer les anciens clients si ce verdict explique leurs 403. Ce résultat n'est pas établi. Accepter aussi `UNEVALUATED` retire un signal substantiel : Google ne fournit alors ni package, ni certificat, ni version dans `appIntegrity`. Les validations exactes supplémentaires du serveur Firebase ne sont pas publiées ; on ne peut donc pas promettre que le SHA-256 enregistré préserve à lui seul une preuve équivalente. Avec aucune exigence de licence ni d'intégrité explicite, ce n'est pas un simple réglage de compatibilité. Toute expérimentation doit mesurer le gain et l'élargissement de confiance pour tous les consommateurs de l'App ID. [Champ de configuration](https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.playIntegrityConfig), [champs absents avec UNEVALUATED](https://developer.android.com/google/play/integrity/verdicts#application-integrity-field)

La [documentation Flutter](https://firebase.google.com/docs/app-check/flutter/default-providers#next_steps) ajoute que certains Android nécessitent d'activer Basic dans Play Console. Cette note ne permet pas de promettre que tous les appareils Android 9 ou non certifiés seront acceptés. Pour les cas réels, il manque toujours la provenance de l'APK, sa signature et, idéalement, les verdicts observés sur l'appareil.

## Coûts et quotas à prévoir

App Check crée une évaluation reCAPTCHA à chaque renouvellement. Avec le TTL par défaut d'une heure, la bibliothèque renouvelle approximativement à mi-durée, donc potentiellement deux évaluations par heure d'utilisation active. Le coût dépend des attestations/renouvellements, pas directement du nombre de lectures API. [Facturation du fournisseur Android](https://firebase.google.com/docs/app-check/android/recaptcha-enterprise-provider#pricing)

Le tarif courant indique **10 000 évaluations gratuites par mois par organisation**, puis **8 USD forfaitaires entre 10 001 et 100 000**, puis **1 USD par 1 000 évaluations supplémentaires** au-delà. L'usage web et mobile ne doit pas être budgété comme deux gratuités indépendantes. Le tableau détaillé donne les SDK mobiles disponibles dans les trois offres ; le tableau marketing n'est pas entièrement aligné sur ce point. Vérifier l'offre effective du projet avant généralisation. [Comparaison officielle des offres](https://docs.cloud.google.com/recaptcha/docs/compare-tiers)

Sans facturation active, dépasser le quota gratuit fait échouer `CreateAssessment` avec une erreur 429/`RESOURCE_EXHAUSTED`. Ajouter reCAPTCHA sans suivre consommation et quotas peut donc recréer un blocage d'accès. [Quotas reCAPTCHA/Fraud Defense](https://docs.cloud.google.com/recaptcha/quotas)

## Alternative custom : conserver App Check reste possible

Un fournisseur personnalisé reçoit une preuve, l'évalue sur un serveur de confiance, puis utilise l'Admin SDK pour émettre un jeton App Check. Il peut préserver la vérification actuelle des backends. Mais Firebase demande précisément que nous fournissions la logique d'authenticité : générer un identifiant d'installation ou un jeton signé ne remplace pas cette preuve. Le TTL des jetons App Check custom va également de **30 minutes à 7 jours** ; la proposition de 15 minutes concerne donc une session propre, pas ce contrat natif. [Fournisseur personnalisé Firebase](https://firebase.google.com/docs/app-check/custom-provider)

Une autorisation propre au Resource service devient défendable si l'on choisit explicitement une politique moins stricte pour la lecture, si les fournisseurs disponibles refusent encore trop d'utilisateurs, ou si l'on a besoin de scopes, de sessions révocables et de quotas durables indépendants des jetons. Ce sont des raisons distinctes du simple besoin d'un jeton temporaire. Elles nécessitent un audit du mécanisme d'admission et du coût de création massive de sessions.

## Conditions pour trancher

1. Vérifier sur des appareils réellement concernés que reCAPTCHA obtient un jeton avec un seuil acceptable, en distinguant installation Play, copie du binaire Play, autre signature et absence de Play services.
2. Vérifier la coexistence d'une ancienne version Play Integrity et d'une version pilote reCAPTCHA, ainsi que les renouvellements, la reconnexion et les downloads repris.
3. Décider si le nouveau profil de confiance est acceptable pour **tous** les backends faisant confiance à l'App ID, avant d'utiliser celui de production.
4. Prévoir coûts, quota mensuel, erreurs réseau et échéance de remplacement du SDK natif.
5. Seulement ensuite choisir entre changement de fournisseur, fournisseur custom ou session limitée au Resource service.

Ces conditions constituent des essais à effectuer, pas des tests déjà réussis. La recherche ne démontre pas que les erreurs actuelles sont toutes causées par le sideload, le pays ou le constructeur, ni que reCAPTCHA les résoudra.

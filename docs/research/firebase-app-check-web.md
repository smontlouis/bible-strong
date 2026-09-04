# Firebase App Check pour Expo Web

Recherche effectuée le 4 septembre 2026 à partir de la documentation officielle Firebase.

## Décision recommandée

Utiliser **reCAPTCHA Enterprise** pour l'application Expo Web. Firebase indique explicitement que les nouvelles intégrations doivent choisir Enterprise et recommande aux applications reCAPTCHA v3 existantes de migrer lorsque possible. Enterprise apporte davantage de signaux de fraude et inclut jusqu'à 10 000 évaluations par mois sans frais. Les clés utilisées par App Check sont basées sur un score et ne présentent pas de challenge interactif à l'utilisateur. ([Firebase — reCAPTCHA v3](https://firebase.google.com/docs/app-check/web/recaptcha-provider), [Firebase — reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider))

## Configuration Firebase / Google Cloud

1. Dans le projet Google Cloud correspondant, activer si nécessaire l'API reCAPTCHA Enterprise et créer une clé de type **Web**, basée sur un score, sans option « checkbox ».
2. Déclarer les domaines réels de l'application Web sur cette clé. Ne pas ajouter `localhost` à une clé destinée à la production.
3. Dans Firebase Console > App Check, enregistrer l'application **Bible Strong Web** avec le fournisseur reCAPTCHA Enterprise et la même clé.
4. Conserver le TTL par défaut d'une heure dans un premier temps : Firebase le considère raisonnable pour la plupart des applications et renouvelle le jeton vers la moitié du TTL.

Firebase documente ces étapes et recommande le seuil de risque par défaut de `0.5` pour la majorité des usages. ([Firebase — configurer reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider))

## Initialisation dans Expo Web

Le bundle Web doit utiliser le SDK JavaScript Firebase, et non le fournisseur natif React Native :

```ts
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'

const appCheck = initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider(recaptchaEnterpriseKey),
  isTokenAutoRefreshEnabled: true,
})
```

`initializeAppCheck()` ne peut être appelé qu'une fois par instance Firebase. L'auto-renouvellement est désactivé par défaut, d'où l'option explicite ci-dessus. `getToken(appCheck, false)` réutilise un jeton valide depuis la mémoire ou IndexedDB et en récupère un nouveau si nécessaire. ([Guide Firebase Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider), [référence SDK JavaScript App Check](https://firebase.google.com/docs/reference/js/app-check))

## Appels au Resource service

Pour un backend personnalisé, le client obtient un jeton avec `getToken()` puis l'envoie dans l'en-tête HTTP `X-Firebase-AppCheck`. Firebase déconseille de placer le jeton dans l'URL. Les jetons à usage limité ne sont nécessaires que si le backend active la protection contre le rejeu. ([Firebase — protéger un backend personnalisé depuis Web](https://firebase.google.com/docs/app-check/web/custom-resource))

Le backend doit vérifier la signature RS256 à partir du JWKS Firebase, le type JWT, l'émetteur, l'expiration et l'audience du projet. Le claim `sub` est l'**App ID Firebase** du client et peut être filtré par allowlist. ([Firebase — vérifier les jetons sur un backend personnalisé](https://firebase.google.com/docs/app-check/custom-resource-backend))

Conséquence pour Bible Strong : en plus d'enregistrer le fournisseur Web, il faut ajouter l'App ID Web à `FIREBASE_APP_CHECK_ALLOWED_APP_IDS`. L'implémentation actuelle du Worker vérifie déjà les claims requis et filtre `sub`, mais sa configuration ne contient que les six App IDs Android/iOS. Voir [`packages/resource-service/src/runtime/firebaseAppCheck.ts`](../../packages/resource-service/src/runtime/firebaseAppCheck.ts) et [`packages/resource-service/wrangler.jsonc`](../../packages/resource-service/wrangler.jsonc).

## Développement local et CI

`localhost` et la CI ne sont pas considérés comme des environnements valides pour l'attestation reCAPTCHA. En développement uniquement, définir avant l'initialisation :

```ts
self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
```

Le SDK affiche alors un jeton dans la console du navigateur. Il faut enregistrer ce jeton dans Firebase Console > App Check > Bible Strong Web > Gérer les jetons de débogage. Il reste stocké localement dans ce navigateur. Pour une CI ou une autre machine, fournir directement la valeur du jeton par un secret d'environnement.

Un jeton debug donne accès depuis un appareil non vérifié : ne jamais le committer ni l'inclure dans un build de production. Firebase avertit également de ne pas contourner ce mécanisme en autorisant `localhost` dans la clé reCAPTCHA de production. ([Firebase — fournisseur debug Web](https://firebase.google.com/docs/app-check/web/debug-provider))

## Ordre de mise en service

1. Enregistrer l'application Web et sa clé Enterprise.
2. Ajouter l'initialisation Web et l'envoi de `X-Firebase-AppCheck`.
3. Ajouter l'App ID Web à l'allowlist du Resource service et déployer le Worker.
4. En local, générer puis enregistrer un jeton debug privé.
5. Vérifier les métriques App Check avec les vrais domaines avant de renforcer l'enforcement des services Firebase. Firebase recommande de surveiller les requêtes légitimes avant l'activation de l'enforcement. ([Firebase — surveillance et enforcement](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider#monitor_metrics_and_enable_enforcement))

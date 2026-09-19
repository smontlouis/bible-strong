# Audit des pages légales Bible Strong — 18 septembre 2026

## Statut

Réécriture locale FR/EN préparée à partir du code de cette branche. **Non déployée ; les points ouverts ci-dessous empêchent de présenter ce texte comme une politique finalisée et conforme.** L'audit du dépôt ne prouve ni la configuration ni le comportement effectif des services en production. Aucun secret ni source du serveur IA privé n'a été consulté ou copié.

L'identité du responsable a été confirmée par le propriétaire : Le Studio 316, contact `stephane@lestudio316.com`. Les informations d'immatriculation ont été relevées sur [Société.com](https://www.societe.com/societe/le-studio-316-941474421.html) et recoupées avec [Pappers](https://www.pappers.fr/entreprise/le-studio-316-941474421) : SAS, capital 1 000 €, siège 56 chemin des Caillats, 74890 Fessy, SIREN 941474421, SIRET 94147442100018, RCS Thonon-les-Bains, TVA FR70941474421.

## Traitements observés

| Fonction | Données et destinataires observés | Preuves dans le dépôt | Limites de l'audit |
| --- | --- | --- | --- |
| Compte | Firebase Auth ; identifiant, e-mail, nom/photo selon fournisseur, état de vérification, fournisseur de connexion dans Firestore | `apps/api/functions/src/users.ts`, `apps/expo/src/helpers/FireAuth.ts`, `FireAuth.web.ts` | Régions, contrats et sauvegardes de production non vérifiés |
| Synchronisation | Notes, favoris, surlignages, annotations, tags, relations, liens, groupes d'onglets ; études séparées | `apps/expo/src/helpers/firestoreSubcollectionNames.ts`, `useLiveUpdates.ts`, `apps/expo/src/redux/firestoreMiddleware.ts` | Ne pas dire que toutes les données restent locales |
| Études publiques | Collection racine `studies`, contenu et auteur ; page publique seulement si `published` | `apps/site/features/studies/helpers.study.ts`, `apps/api/functions/src/studies.ts` | Copies externes et aperçus Storage distincts du profil |
| Mesure d'usage | Firebase Analytics, événements de connexion/inscription, écrans, compteurs de notes et progression ; `setUserId` | `apps/expo/src/helpers/analytics*.ts`, `apps/expo/src/redux/analyticsMiddleware.ts` | Aucun mécanisme de consentement retrouvé dans ce périmètre ; mesure conditionnée au mode production/configuration, pas au choix de consentement |
| Erreurs | Sentry ; native : ID/e-mail explicites ; web : objet profil explicite | `RootLayout.native.tsx`, `RootLayout.web.tsx`, `FireAuth.ts`, `FireAuth.web.ts` | `sendDefaultPii: false` sur native ne neutralise pas les champs explicitement passés à `setUser` |
| Recherche | Requêtes traitées par le service ; recherche sémantique via Cloudflare Workers AI ; statistiques de contenu avec masquage partiel sans identifiants de compte/appareil/session | ADR 0031, `packages/resource-service/src/analytics/searchAnalytics.ts`, `src/runtime/worker.ts`, `src/runtime/searchAnalyticsEngine.ts` | Masquage par motifs ≠ anonymisation garantie ; durée de rétention effective à confirmer |
| Sécurité web | Firebase App Check / reCAPTCHA Enterprise | `apps/expo/src/helpers/resourceAppCheck.web.ts` | Données/traceurs et configuration fournisseur à vérifier en production |
| Assistant IA | Requêtes authentifiées, messages/historique/contexte éditorial ; résumé distant ; historique et mémoire dans localStorage par compte | `apps/expo/src/features/study-assistant/client.ts`, `conversations.ts`, `conversationRun.ts`, ADR 0051 | Fournisseurs, journalisation, rétention, entraînement et garanties de transfert du serveur privé non vérifiés |
| Paiement | Stripe Buy Button sur le site, lien PayPal dans l'application | `apps/site/pages/give.tsx`, `apps/expo/src/features/settings/SupportScreen.tsx` | Vérifier titulaire des comptes marchands et éventuelles souscriptions historiques |
| Anciennes souscriptions | Endpoint IAPHUB encore exporté ; état `subscription` écrit sur le compte | `apps/api/functions/src/iaphub.ts`, `index.ts` | Présence du code ≠ preuve d'utilisation actuelle ; confirmer si encore actif avant publication |
| Hébergement | Site hébergé chez Vercel (confirmé par le propriétaire) ; ressources sur Cloudflare ; base des ressources sur Neon | `apps/site/vercel.json`, `apps/site/README.md`, ADR 0009 | Les ressources éditoriales stockées sur Neon ne prouvent pas que les profils utilisateurs y sont stockés ; hébergeur du site public confirmé |

## Suppression : défaut reproduit et corrigé localement

Le défaut initial a été reproduit par un test exécutant le vrai déclencheur `deleteUser` avec les SDK simulés : les études privées et publiques de la collection racine `studies` survivaient à la suppression du compte.

Le déclencheur recherche maintenant les études par `user.id`, par pages de 100, sans filtre sur leur publication. Pour chacune, il supprime les deux aperçus Storage connus à partir de l'identifiant réel du document (et non du champ `id` modifiable), puis ses descendants et son document. Il supprime ensuite les sous-collections du profil puis le profil lui-même. Le parent reste présent si une opération préalable échoue, afin que la reprise puisse retrouver les données restantes. La suppression récursive du SDK prend en charge les descendants dont un document intermédiaire est absent.

Les erreurs remontent et les nouvelles tentatives Firebase sont activées. Les fichiers déjà absents sont tolérés, notamment lorsque le déclencheur indépendant `deleteStudy` reçoit ensuite le même événement. Ce dernier utilise le même nettoyage, l'identifiant réel du document et une politique de reprise, sans masquer les erreurs Storage.

Les textes FR/EN n'imposent plus de supprimer/dépublier les études avant la suppression du compte. Cette correction exige le déploiement des fonctions `deleteUser` et `deleteStudy` avant ou avec celui du site. Elle ne déclenche pas rétroactivement le nettoyage des comptes supprimés avant son déploiement.

Le correctif ne demande pas d'effacement à Sentry, Analytics, aux prestataires de paiement ou au serveur IA. Les copies locales, exports et copies détenues par des tiers restent distincts. Les restrictions décrites à leur sujet dans les pages légales restent applicables.

Tests : études privées/publiques et données imbriquées, isolation des autres comptes, 505 études, événements répétés, aperçu absent, échec Storage et reprise, échec des descendants et reprise, profil absent, suppression indépendante d'étude avec champ `id` incorrect et erreurs propagées. Tests sans connexion à Firebase en production ; SDK simulés à la frontière, déclencheurs réels exécutés.

## Changements préparés

- Pages de confidentialité et conditions FR/EN réécrites avec une présentation et une identité commune.
- Les deux anciennes routes de suppression partagent désormais les mêmes instructions ; leurs variantes `/fr/` sont traduites, titre compris.
- Toutes les anciennes URL sont conservées ; attribut de langue corrigé pour les URL légales historiques.
- Liens confidentialité / conditions / suppression depuis les pages légales et la page d'accueil.
- Ancien script Universal Analytics `UA-109677220-2` retiré de la racine du site ; aucune modification des statistiques de l'application Expo.
- Promesse d'effacement en 24 h retirée ; distinction compte / études / copies locales / prestataires.
- Aucun déploiement ni modification de données utilisateurs réelles. Politiques de reprise des fonctions modifiées localement.

## Informations et décisions nécessaires avant publication

1. **Assistant IA** : Gloo confirmé par le propriétaire comme intermédiaire. Identifier les fournisseurs de modèles effectivement sollicités, données reçues, pays/régions, politique de conservation (requêtes, réponses, logs, quotas), suppression et usage éventuel pour entraînement. Question envoyée au propriétaire. Ne pas promettre « aucun stockage » ou « pas d'entraînement » sans preuve.
2. **Rétention** : relever les réglages réels Firebase/GA4, Sentry, Cloudflare Analytics Engine/Workers/AI Gateway, hébergeur et sauvegardes. Fixer les durées de support et les critères de purge des comptes inactifs. Remplacer les formulations générales du brouillon par les durées ou critères effectivement appliqués.
3. **Bases légales et données sensibles** : qualifier chaque finalité. Le fonctionnement demandé du compte peut relever du contrat ; la sécurité d'un intérêt légitime documenté ; la mesure non nécessaire d'un consentement selon ses modalités. Les notes et messages susceptibles de révéler des convictions religieuses exigent aussi une condition de l'article 9. La version actuelle ne prouve pas un recueil explicite de consentement. Ne pas assimiler création de compte, clic « envoyer » ou acceptation de la politique à un tel recueil.
4. **Traceurs de l'application** : définir puis implémenter le mécanisme approprié de consentement avant les traitements qui l'exigent et son retrait. Vérifier la collecte native automatique. La suppression de l'ancien tag du site ne règle pas la collecte Firebase de l'application web/mobile, ni les services tiers.
5. **Mentions de l'éditeur** : Vercel confirmé par le propriétaire et ajouté aux pages FR/EN. Instruction explicite : ne pas afficher son numéro de téléphone personnel ; aucun numéro personnel ne doit être recherché ou ajouté. Le contact public reste `stephane@lestudio316.com`. Le directeur de publication reste à confirmer. Service Public mentionne un téléphone de contact de l'entreprise : une ligne professionnelle distincte peut répondre à ce besoin sans exposer un numéro personnel, mais aucune ligne n'a été fournie. Les coordonnées complètes de l'hébergeur restent à vérifier. Les mentions ne sont donc pas déclarées exhaustives.
6. **Destinataires et transferts** : valider les contrats de sous-traitance, lieux de traitement et garanties hors EEE ; renseigner les informations précises dans la politique. Les liens vers les politiques fournisseurs ne remplacent pas cette information.
7. **Paiements** : confirmer si IAPHUB et les anciennes souscriptions restent utilisés ; vérifier que Stripe et PayPal relèvent désormais de Le Studio 316. Évaluer les obligations supplémentaires si une offre payante ou un abonnement est effectivement proposé (conditions de vente, rétractation, médiation).
8. **Licence Apple** : version réécrite à vérifier par rapport à la licence enregistrée dans App Store Connect ; compléter les obligations applicables, notamment un éventuel téléphone professionnel distinct du numéro personnel, dont la publication est exclue par le propriétaire. Ne pas affirmer que cette réécriture suffit à toutes les exigences d'une licence personnalisée Apple.

Ces points ne sont pas des demandes d'autorisation supplémentaires pour les modifications locales. Ils distinguent les faits vérifiés des éléments que le dépôt ne permet pas d'établir.

## Sources de référence consultées

- [CNIL — information des personnes](https://www.cnil.fr/fr/informer-les-personnes) : transparence, finalités, destinataires, bases et conservation.
- [CNIL — données sensibles](https://www.cnil.fr/fr/definition/donnee-sensible) : convictions religieuses et conditions particulières.
- [CNIL — bases légales](https://www.cnil.fr/fr/les-bases-legales/liceite-essentiel-sur-les-bases-legales).
- [CNIL — effacement](https://www.cnil.fr/fr/comprendre-mes-droits/le-droit-leffacement-supprimer-vos-donnees-en-ligne) : traitement des demandes et délais.
- [CNIL — cookies et traceurs](https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi) : consentement et exemptions.
- [Google — arrêt d'Universal Analytics](https://support.google.com/analytics/answer/10089681?hl=en-DE).
- [Apple — minimum terms for custom EULAs](https://www.apple.com/legal/internet-services/itunes/dev/minterms/).
- [Service Public — mentions obligatoires d'une société](https://entreprendre.service-public.gouv.fr/vosdroits/F37351).

## Validation de cette réécriture

- `yarn workspace @bible-strong/site typecheck` : réussi.
- `yarn workspace @bible-strong/site build` : réussi (avertissements du bundler, pas d'échec).
- `yarn workspace @bible-strong/site test` : 16 tests existants réussis.
- React Doctor sur les changements du site : aucune anomalie signalée, score 97/100.
- Serveur de production local sur un port temporaire : 12 URL légales + 2 accueils vérifiés par requêtes HTTP. Statut 200, langues du document et du contenu, titre principal unique, identifiants de sections et références ARIA, coordonnées du responsable, liens d'accueil et absence du script Google Tag Manager vérifiés.
- `git diff --check` : réussi.
- Pas de vérification visuelle dans un navigateur ni de validation des services en production. Le serveur de vérification local a été arrêté après contrôle.

### Validation du correctif de suppression

- API : 9 tests réussis (dont 8 scénarios de suppression), typecheck, lint et build réussis.
- Site : typecheck et `git diff --check` réussis après mise à jour des textes.
- Contrôle architecture réussi, avec 454 avertissements sur le dépôt. Rapport généré non inclus dans le correctif.
- Aucun compte réel supprimé, aucun déploiement exécuté. Validation Firebase réelle et activation des reprises à vérifier lors du déploiement ciblé.

## Référence HelloBible et vérification Gloo — 18 septembre 2026

Le propriétaire confirme que Bible Strong utilise également Gloo AI. Cette identité est ajoutée à la confidentialité FR/EN avec des liens vers les conditions AI Studio et le DPA. Aucun modèle précis n'est attribué à Bible Strong sans vérification de son routage.

Sources consultées :
- [CGU HelloBible](https://www.hellobible.ai/fr/legal/mentions-legales), révision annoncée du 21 août 2026.
- [Confidentialité HelloBible](https://www.hellobible.ai/fr/legal/confidentialite), même date.
- [Conditions spécifiques Gloo AI Studio](https://gloo.com/legal/ai-studio-supplemental-terms-of-service).

HelloBible distingue le routage Gloo du stockage de son application et expose les limites des réponses bibliques automatiques. Sa personnalisation et sa conservation de profils ne constituent pas une preuve du fonctionnement de Bible Strong. Ses engagements ne sont pas recopiés comme garanties de notre application.

Les conditions Gloo AI Studio prévoient une permission explicite séparée pour l'entraînement, désactivé par défaut. Elles décrivent aussi des usages optionnels de transmission vers d'autres offres et de contenus hors prompts pour enrichir des réponses, avec des réglages de retrait. Ces catégories ne doivent pas être confondues. Elles ne prouvent ni une rétention nulle ni l'état de nos réglages. Vérifier le contrat applicable, les options du compte Gloo et les fournisseurs effectivement sollicités avant toute garantie « jamais utilisé pour l'entraînement » ou « aucun stockage ». Les garanties affichées pour Data Engine ou Ministry Chat ne sont pas automatiquement celles de l'API utilisée par Bible Strong.

Les TOS FR/EN précisent désormais que les réponses du logiciel ne constituent pas une autorité doctrinale. Les questions ouvertes restent : modèles et sous-traitants, logs et rétention côté serveur/Gloo/modèles, entraînement et usages optionnels, transferts et suppression distante.

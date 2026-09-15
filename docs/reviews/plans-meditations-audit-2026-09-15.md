# Audit UI, UX et fonctionnel — 15 septembre 2026

Base : `c971f091f`. Audit sans modification du code produit ni des participations du compte.

## Verdict

Le fonctionnement principal est cohérent, mais la fonctionnalité ne peut pas être déclarée entièrement validée. Deux défauts fonctionnels, un défaut d'import de texte et plusieurs problèmes de présentation restent à corriger.

## Constats prioritaires

### P1 — Réouverture potentiellement bloquée après arrêt d'un plan

`useDailyMeditation.ts:47–55` conserve les données React Query avec `staleTime: Infinity`, mais ne lit le contenu que dans Redux. `removePlan` retire le contenu de Redux sans invalider la requête. Après un premier chargement dans la session, arrêter puis rouvrir le plan laisse donc une requête réussie/fraîche sans contenu Redux ; le lecteur peut rester au chargement sans bouton de réessai.

Reproduction isolée avec les vrais QueryClient/QueryObserver installés : charger une requête dont queryFn alimente un magasin externe, vider ce magasin, puis monter un observateur activé avec la même clé et `staleTime: Infinity`. Résultat : `calls=1`, `reduxHasPlan=false`, `queryStatus=success`, `fetchStatus=idle`. L'arrêt d'un plan réel du compte n'a pas été exécuté pour cet audit.

Correction proposée : unifier la source de données ou réhydrater Redux depuis les données de requête ; invalider/supprimer la requête lors du retrait. Tester retrait/réouverture et changement de compte.

### P2 — Ancienne participation sans date privée de calendrier et de rappel

Une participation avec historique mais sans `startDate` est correctement reconnue comme commencée par `hasPlanParticipation`. Son bouton principal ne propose donc plus de démarrage. Pourtant, `Menu.tsx:110` n'affiche l'action de date et le rappel que si `startDate` existe déjà. Il n'existe plus de moyen d'attribuer une première date sans remise à zéro. Constat statique des branches, sans mutation du compte.

Correction proposée : proposer une action explicite d'association au calendrier pour ces participations, en conservant leurs lectures cochées.

### P2 — Vers des poèmes collés dans La Bonne Semence

Constaté dans `/meditation?collectionId=la-bonne-semence-2026&date=2026-09-15`, « Grâce et paix » : `s’écrouler,Bousculé`, `l’assuranceQue`, `l’expérienceDe`.

Le défaut est déjà présent dans `output/imports/la-bonne-semence-2021-2026/readings.json`, donc antérieur au rendu. Vérification de la page officielle : les lignes sont séparées par des `<div class="vers">`, groupées dans des `<div class="strophe">`. `collect.py:7` ne conserve de séparateurs que pour p/li/br et colle ces div.

Correction proposée : conserver les vers et les strophes, réextraire les journées touchées puis republier uniquement les sections corrigées. Ne pas appliquer une correction heuristique des espaces au texte affiché.

### P2 — Coche de fin de lecture ambiguë et non nommée

`ReadButton.tsx:57–67` bascule le statut même si la journée est déjà lue ; seule l'opacité indique la différence. Relire une journée puis toucher la coche peut donc annuler sa lecture. L'arbre d'accessibilité web expose le bouton uniquement comme un glyphe, sans nom explicite.

Correction proposée : nom et état accessibles, validation idempotente d'une lecture ; réserver l'annulation à l'action explicite « Marquer comme non lu » déjà disponible.

## UI / UX secondaires

- La couverture du recueil La Bonne Semence 2026 affiche visiblement **2020**, aussi bien dans la fiche que dans le lecteur. Prévoir une couverture d'édition correcte ou une couverture neutre.
- Sur la page d'un plan commencé, le même « Jour 1 sur 6 » apparaît sous le titre et en tête du calendrier. Garder une hiérarchie plus nette entre progression générale et journée sélectionnée.
- Les six parcours Bible Strong utilisent une famille de couvertures cohérente, mais leur petit texte devient illisible dans les vignettes de catalogue. Un visuel simplifié pour les petites tailles serait préférable.

## Pages examinées

| Surface | Vérification | Résultat |
| --- | --- | --- |
| Accueil | Code des deux variantes du widget et navigation web | Notification conditionnée au mobile ; attribution vers le recueil |
| Catalogue des plans | Navigation web, code de fusion catalogue/cache | Groupes FR/EN, séparation participation/contenu et durée cohérents |
| Page de plan | Capture du Caractère de Dieu, ouverture du lecteur | Journées lisibles sans ellipsis ; doublon de progression ; cas legacy à corriger |
| Lecteur de plan | Ouverture d'une journée BibleProject et arbre accessible | Texte et passages présents, liens bibliques reconnus ; coche ambiguë |
| Choix de méditation | Arbre accessible et code | Choix distinct de l'ouverture du recueil ; sections FR/EN |
| Fiche de recueil | Capture La Bonne Semence 2026 et lecture du code | Navigation mensuelle et sélection compactes ; couverture d'édition incohérente |
| Lecteur de méditation | Capture Grâce et paix, comparaison source/import | Typographie du verset et du texte cohérente ; retours à la ligne perdus à l'import |
| Menus/rappels | Code et tests | Rappel masqué sur web ; impasse des anciennes participations sans date |

## Validation et limites

- 17 suites / 116 tests plans et méditations passent.
- Reproduction isolée du conflit cache React Query / Redux avec la bibliothèque installée.
- Comparaison du texte de méditation avec sa source officielle.
- Contrôle visuel web des surfaces ci-dessus, sans modification de progression ni de préférences.
- Pas de validation sur appareil iOS/Android, de réception réelle des notifications, de synchronisation entre appareils ni de scénario réseau interrompu complet. Le passage des tests ne vaut pas validation de ces intégrations.
- Aucun correctif produit appliqué dans cette passe.

## Correctifs appliqués après validation de l'utilisateur

- Cache : requête périmée lors de la réouverture, avec réhydratation Redux par le chargement ; test de retrait/réouverture utilisant le vrai QueryClient.
- Legacy : action « Définir la date de départ », confirmation explicite même pour aujourd'hui, conservation du suivi ; rappel disponible une fois le calendrier défini.
- Fin de lecture : valider une relecture ne modifie plus sa progression ; bouton de retour nommé et icône de retour pour les journées déjà terminées. L'annulation reste une action distincte du menu.
- Poèmes : séparateurs de vers/strophes restaurés dans 114 lectures depuis les sources contrôlées ; 54 sections republiées avec préconditions de version.
- Couvertures : illustration neutre pour les six éditions La Bonne Semence, vignettes Bible Strong simplifiées.
- Progression : suppression du texte répété sous le titre du plan ; barre et journée sélectionnée conservées.

Validation : 120 tests plans/méditations, un test du parseur de poèmes, cinq tests de préparation des plans, typage, ESLint ciblé, garde de styles et export web passent. Les 72 documents publiés sont relus et vérifiés. Les limites de validation native et de réception réelle des notifications restent applicables.

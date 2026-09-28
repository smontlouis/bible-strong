# Chargement bloqué après une mise à jour v26 → v27

Date : 23 septembre 2026. Version signalée : 27.0.15, Android et iOS.
Mise à jour : 24 septembre 2026. Statut : diagnostic incomplet ; aucun changement applicatif conservé.

## Périmètre et vérifications

Le commit `fe8460337` contient la version 27.0.15. Les fichiers de démarrage
`RootLayout.native.tsx`, `store.ts`, `localMigrationRegistry.ts`, `storage.ts` et
`biblesDb.ts` ne diffèrent pas entre ce commit et `264ea9c66`.

Les quatre suites ciblées passent, soit 20 tests : `storageStartupMigration`,
`localMigrationRegistry`, `LocalMigrationGate` et les migrations Redux.

Un banc temporaire a exécuté les fonctions de migration de l'index de recherche
sur SQLite FTS5 en mémoire, avec un schéma dérivé de la v26.0.11 (`2e6e85a94`).
Les migrations ont terminé avec 0, 31 000 et 310 000 versets synthétiques
(respectivement environ 2 ms, 134 ms et 1,4 s sur le Mac). Ce test ne reproduit
ni le pont natif Expo, ni les transactions sur des connexions distinctes, ni un
fichier réel d'utilisateur, ni les performances d'un téléphone. Il ne permet
donc pas d'exclure un blocage natif SQLite.

## Évidence Sentry

Les requêtes d'événements ci-dessous sont filtrées par `release:*27.0.15*`.
Les compteurs globaux des issues ne doivent pas être présentés comme des
compteurs de cette seule version.

- [BIBLE-STRONG-M7P](https://sevn-apps.sentry.io/issues/148321650/) :
  `APP_MIGRATION_RUNNER_BUSY`, événement `app_migration.inspection_failed`, phase
  locale. Dans plusieurs événements Android, une première ouverture atteint
  `persist/REHYDRATE` et `root.layout.ready`, sans étape de migration détectée
  visible dans les breadcrumbs conservés. Une ouverture ultérieure et les
  tentatives suivantes échouent avec le verrou occupé. Exemple :
  `347284240ab94a60b21e08812d4a9621`, première ouverture à 17:42:52 UTC,
  nouvelle ouverture à 17:44:36 UTC le 22 septembre.
- Le verrou de `mmkvMigrationStateStore.runExclusive` est en mémoire et libéré
  dans un `finally`. Un verrou occupé prouve qu'une autre opération n'a pas
  terminé dans ce runtime ; ce n'est pas un verrou obsolète enregistré sur
  disque. Les données disponibles ne nomment pas la sous-opération en attente.
- [BIBLE-STRONG-KB7](https://sevn-apps.sentry.io/issues/141990881/) :
  le dernier événement examiné en 27.0.15 concerne un délai de synchronisation
  de compte de 15 secondes, avec interactions et lecture déjà actives. Ce cas
  ne démontre pas un blocage du chargement initial.
- [BIBLE-STRONG-HXR](https://sevn-apps.sentry.io/issues/126207459/) regroupe des
  erreurs différentes. Les événements filtrés sur le démarrage incluent des
  échecs de téléchargement et une base malformée pendant l'installation de BHG.
  Le titre global de l'issue ne suffit pas à conclure à une corruption SQLite
  lors de l'inspection initiale.
- [BIBLE-STRONG-J1H](https://sevn-apps.sentry.io/issues/127942402/) : les
  événements iOS inspectés ne donnent pas une preuve équivalente du verrou de
  migration. Certains concernent une application déjà utilisable. Un événement
  montre un intervalle prolongé avant `resource_app_check.initialized`, mais
  cela ne distingue pas une attente active d'une suspension de l'application.

## Ce qui reste à établir

Le rendu `LocalMigrationGate` en cours d'inspection affiche un indicateur et
« Chargement… ». Les rendus `StartupLoading`, notamment celui de `PersistGate`,
affichent seulement un indicateur. L'utilisateur a confirmé le 24 septembre
que seul le spinner était visible. La piste `APP_MIGRATION_RUNNER_BUSY` ne doit
donc pas être assimilée à ce signalement : il faut cibler la préparation initiale,
la restauration Redux ou le fallback Suspense du rendu applicatif.

Pour l'inspection locale, le parcours est : préparation du stockage et du journal
d'installation, lecture des références persistées, inventaire des Bibles SQLite
et fichiers historiques, puis vérification des ressources de remplacement.
Il manque des événements permettant d'identifier laquelle de ces attentes reste
active sur un appareil concerné.

Ne pas forcer la libération du verrou ni considérer une migration terminée après
un simple délai : l'opération d'origine pourrait encore modifier les données.
Ne pas présenter les erreurs Sentry trouvées comme la cause confirmée de tous
les signalements Android et iOS. La prochaine preuve utile est un journal corrélé à un incident effectivement signalé.

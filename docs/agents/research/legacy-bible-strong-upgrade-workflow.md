# Workflow de mise à niveau des anciennes Bibles vers les sidecars Strong

_Audit en lecture seule réalisé le 24 juillet 2026._

> **Statut historique (2026-08-15)** — Ce document explique le chemin de mise à niveau observé le
> 24 juillet. La migration de publication et le catalogue mobile ont ensuite évolué. Ne pas utiliser
> ses chemins de fichiers, déclencheurs ou limites de retry comme description du runtime courant ;
> consulter les ADR 0013, 0015 et 0021 ainsi que `src/migrations/legacyResourceMigration.ts`.

## Réponse courte

Une ancienne LSG, DBY ou DBR correctement importée n’est pas supprimée ni déclarée absente lors de
la mise à jour de l’application. Son texte reste lisible depuis `bibles.sqlite`. En revanche, elle
est considérée comme **base incompatible avec le nouvel index Strong**, car son enregistrement ne
porte pas les nouveaux `textRevision` et `textSha256`.

Quand l’utilisateur demande ensuite l’index Strong depuis les surfaces prévues, l’application
planifie donc deux téléchargements séquentiels :

1. le nouveau JSON canonique ZIP de la Bible, importé à la place de l’ancien texte dans
   `bibles.sqlite` ;
2. le SQLite Strong ZIP, installé seulement après la réussite de la Bible canonique.

Le changement d’URL de `.json` vers `.json.zip` n’invalide pas à lui seul une installation
existante. Il n’existe actuellement aucune détection automatique de nouvelle révision biblique :
`getIfVersionNeedsUpdate` retourne toujours `false`
([`bibleVersions.ts:22`](../../../src/helpers/bibleVersions.ts#L22)). Un utilisateur qui ne demande
jamais Strong et ne relance jamais explicitement le téléchargement peut donc conserver
indéfiniment son ancien texte.

## Les deux états historiques possibles

### 1. L’utilisateur possède encore `bible-DBY.json`

Au démarrage, la migration historique cherche les fichiers `bible-*.json` à la racine et dans
`fr/` ou `en/`, transforme le nom en identifiant de version, puis importe le JSON dans
`bibles.sqlite`
([`bibleMigration.ts:76`](../../../src/helpers/bibleMigration.ts#L76),
[`bibleMigration.ts:95`](../../../src/helpers/bibleMigration.ts#L95),
[`bibleMigration.ts:131`](../../../src/helpers/bibleMigration.ts#L131)). DBY, DBR et LSG ne font
pas partie des versions exclues : seules INT, INT_EN, LSGS et KJVS sont classées comme anciennes
« Strong versions »
([`bibleMigration.ts:104`](../../../src/helpers/bibleMigration.ts#L104),
[`bibleVersions.ts:765`](../../../src/helpers/bibleVersions.ts#L765)).

Le fichier JSON n’est supprimé qu’après une insertion réussie
([`bibleMigration.ts:138`](../../../src/helpers/bibleMigration.ts#L138)). La migration est suivie
par version et peut reprendre après un redémarrage. Elle est tentée au plus trois fois
([`bibleMigration.ts:7`](../../../src/helpers/bibleMigration.ts#L7),
[`bibleMigration.ts:171`](../../../src/helpers/bibleMigration.ts#L171)). Le démarrage ouvre d’abord
`bibles.sqlite`, exécute cette migration si nécessaire, puis signale aux lecteurs de recharger
leurs chapitres
([`InitHooks.tsx:50`](../../../src/common/InitHooks.tsx#L50),
[`InitHooks.tsx:71`](../../../src/common/InitHooks.tsx#L71),
[`InitHooks.tsx:100`](../../../src/common/InitHooks.tsx#L100)).

L’importeur accepte encore explicitement l’ancien format où chaque verset est une simple chaîne.
Il l’enregistre avec une présentation vide et sans métadonnées de révision
([`biblesDb.ts:649`](../../../src/helpers/biblesDb.ts#L649),
[`biblesDb.ts:671`](../../../src/helpers/biblesDb.ts#L671),
[`biblesDb.ts:732`](../../../src/helpers/biblesDb.ts#L732)).

### 2. L’utilisateur avait déjà migré sa Bible vers `bibles.sqlite`

C’est vraisemblablement le cas principal pour un utilisateur récent. L’ouverture de la base ajoute
les nouvelles colonnes de présentation et de publication si elles n’existent pas, sans réimporter
la Bible. Les anciennes lignes de `versions_meta` restent donc présentes avec
`text_revision = NULL`, `text_sha256 = NULL`, `source_sha256 = NULL` et
`schema_version = NULL`
([`biblesDb.ts:196`](../../../src/helpers/biblesDb.ts#L196),
[`biblesDb.ts:204`](../../../src/helpers/biblesDb.ts#L204)).

La Bible reste installée parce que la détection normale vérifie uniquement la présence de son
identifiant dans `versions_meta`, et non son URL, son checksum ou sa révision
([`biblesDb.ts:562`](../../../src/helpers/biblesDb.ts#L562)). Le lecteur continue à récupérer les
versets depuis la table partagée
([`bibleContentAccess.ts:119`](../../../src/features/resources/bibleContentAccess.ts#L119)).

## Différence entre « installée » et « compatible Strong »

Ces notions sont distinctes :

- **Bible installée** : une ligne `versions_meta` suffit.
- **Bible compatible Strong** : `textRevision` et `textSha256` doivent correspondre exactement à
  la publication du sidecar.

La disponibilité du sidecar retourne `base-missing` si aucune métadonnée de Bible n’existe, puis
`base-incompatible` si les deux empreintes ne correspondent pas
([`strongBibleSidecar.ts:68`](../../../src/helpers/strongBibleSidecar.ts#L68)). Une ancienne Bible
migrée possède bien une ligne de métadonnées, mais ses deux empreintes sont absentes : elle apparaît
donc comme Bible installée dans les sélecteurs tout en étant `base-incompatible` pour Strong.

Cette séparation empêche d’appliquer les offsets du nouvel index à un texte ancien. Le contrat de
publication impose d’ailleurs les mêmes `textRevision` et `textSha256` aux deux archives
([`strongBiblePublications.ts:83`](../../../src/helpers/strongBiblePublications.ts#L83),
[`strongBiblePublications.ts:100`](../../../src/helpers/strongBiblePublications.ts#L100)).

## Que se passe-t-il quand l’utilisateur télécharge Strong ?

Les appels des surfaces Strong utilisent `createStrongSidecarDownloadPlan`. Pour
`base-missing` **ou** `base-incompatible`, cette fonction crée :

1. `bible:DBY`, pointant vers le nouveau `bible-dby.json.zip` ;
2. `bible-strong:DBY`, avec `dependsOnId: bible:DBY`.

([`downloadItemFactory.ts:78`](../../../src/helpers/downloadItemFactory.ts#L78),
[`downloadItemFactory.ts:20`](../../../src/helpers/downloadItemFactory.ts#L20)).

La file n’autorise le second item à démarrer qu’après l’état `completed` de la Bible. Si la Bible
échoue ou est annulée, le sidecar est bloqué
([`downloadQueueScheduling.ts:8`](../../../src/helpers/downloadQueueScheduling.ts#L8)). Ce
comportement est aussi couvert par le test du plan de téléchargement
([`strongBibleDownloadPlan-test.ts:27`](../../../src/helpers/__tests__/strongBibleDownloadPlan-test.ts#L27)).

Le ZIP canonique est téléchargé dans le cache, vérifié, décompressé, relu et validé avant
l’insertion
([`downloadBibleToSqlite.ts:53`](../../../src/helpers/downloadBibleToSqlite.ts#L53),
[`downloadBibleToSqlite.ts:76`](../../../src/helpers/downloadBibleToSqlite.ts#L76),
[`downloadBibleToSqlite.ts:125`](../../../src/helpers/downloadBibleToSqlite.ts#L125)).
L’insertion remplace la version existante dans une transaction SQLite exclusive et écrit ensuite
les nouvelles métadonnées
([`biblesDb.ts:627`](../../../src/helpers/biblesDb.ts#L627),
[`biblesDb.ts:635`](../../../src/helpers/biblesDb.ts#L635),
[`biblesDb.ts:732`](../../../src/helpers/biblesDb.ts#L732)). Une erreur avant l’insertion ne touche
pas l’ancienne Bible ; une erreur dans la transaction doit provoquer son rollback.

Le sidecar refuse également de s’installer directement si la Bible canonique compatible n’est pas
présente
([`strongBibleSidecar.ts:140`](../../../src/helpers/strongBibleSidecar.ts#L140)). Autrement dit,
depuis l’UI normale, « télécharger Strong » retélécharge bien la Bible lorsque sa base est ancienne,
mais ne la retélécharge pas si elle possède déjà la bonne révision.

## Fallbacks réels

### Pendant la lecture

Le texte normal est toujours lu dans `bibles.sqlite`. Si le mode Strong est activé mais que le
sidecar manque, est incompatible ou échoue, le lecteur capture l’erreur et renvoie le texte normal
sans spans Strong
([`bibleContentAccess.ts:128`](../../../src/features/resources/bibleContentAccess.ts#L128),
[`bibleContentAccess.ts:136`](../../../src/features/resources/bibleContentAccess.ts#L136)).

### Pour un JSON historique resté sur disque

Le lecteur régulier n’ouvre plus directement les anciens JSON et interroge uniquement
`bibles.sqlite`
([`bibleContentAccess.ts:119`](../../../src/features/resources/bibleContentAccess.ts#L119)).
La disponibilité suit désormais exactement cette capacité de lecture : si l’import SQLite n’a pas
réussi, la Bible est déclarée absente même si `bible-DBY.json` existe encore
([`resourceAvailability.ts:131`](../../../src/features/resources/resourceAvailability.ts#L131)).

Ainsi, si l’import échoue trois fois et que la migration globale cesse de réessayer, le fichier
historique est conservé sur disque, mais il ne crée plus de faux état « disponible ». L’utilisateur
peut télécharger la publication canonique pour rétablir une copie lisible
([`bibleMigration.ts:151`](../../../src/helpers/bibleMigration.ts#L151),
[`bibleMigration.ts:171`](../../../src/helpers/bibleMigration.ts#L171)).

## Effet du passage des URLs JSON aux ZIP

Pour LSG, DBY et DBR, la factory de téléchargement ignore désormais l’ancienne entrée
`biblesRef` et choisit l’URL ZIP de la publication ainsi que son manifeste de checksums
([`downloadItemFactory.ts:23`](../../../src/helpers/downloadItemFactory.ts#L23),
[`strongBiblePublications.ts:45`](../../../src/helpers/strongBiblePublications.ts#L45)).

Cela ne modifie que les **prochains téléchargements**. L’application ne mémorise pas l’URL d’origine
dans `versions_meta`, et la détection d’installation ne la compare jamais. De plus, la détection de
mise à jour des Bibles est actuellement désactivée par son `return false`
([`bibleVersions.ts:22`](../../../src/helpers/bibleVersions.ts#L22)).

Conséquences :

- l’ancien texte reste lisible et affiché comme téléchargé ;
- il n’est pas automatiquement remplacé par le JSON canonique lors de l’update de l’application ;
- demander Strong provoque sa mise à niveau implicite avant le sidecar ;
- retélécharger explicitement la Bible utilise également le nouveau ZIP ;
- sans l’une de ces actions, la Bible conserve son ancien texte et sa présentation historique.

## Tableau des scénarios

| État avant mise à jour | Bible après démarrage | État Strong | Action « télécharger Strong » |
|---|---|---|---|
| Ancien `bible-DBY.json`, migration réussie | Installée et lisible dans `bibles.sqlite`; JSON supprimé | `base-incompatible` | Télécharge Bible canonique ZIP, puis sidecar ZIP |
| Ancienne DBY déjà dans `bibles.sqlite` | Toujours installée et lisible | `base-incompatible` car révision absente | Télécharge Bible canonique ZIP, puis sidecar ZIP |
| Bible canonique actuelle, aucun sidecar | Installée et lisible | `missing` | Télécharge uniquement le sidecar |
| Bible canonique actuelle, sidecar compatible | Installée avec Strong | `available` | Aucun besoin de téléchargement |
| Aucun texte local | Absente | `base-missing` | Télécharge Bible canonique ZIP, puis sidecar ZIP |
| JSON historique dont la migration échoue trois fois | Déclarée absente et retéléchargeable; le JSON non importé n’est pas utilisé | `base-missing` | Le plan Strong retélécharge la Bible canonique puis le sidecar |

## Conclusion et lacune à traiter

Le chemin Strong est sûr vis-à-vis des offsets : il ne mélange pas une ancienne DBY avec le nouveau
sidecar. Un JSON historique non importé ne crée plus non plus de faux état disponible. La mise à
niveau reste volontairement **paresseuse**, déclenchée par le téléchargement Strong ou une action
explicite de remplacement, et non par l’update de l’application.

Si la politique produit change et exige que tous les utilisateurs de LSG, DBY et DBR bénéficient
immédiatement du nouveau texte canonique et de sa présentation, il faudra une migration de
publication dédiée. Le simple changement des URLs ne remplit pas ce rôle.

## Validation de la correction

La correction de disponibilité a été validée avec :

- le test ciblé de `resourceAvailability` : 5 tests réussis ;
- les tests ciblés de disponibilité et de planification Strong : 10 tests réussis ;
- le typecheck TypeScript ;
- la suite Jest complète : 91 suites et 645 tests réussis ;
- Prettier, ESLint sans erreur, les contrôles d’architecture et de qualité du dépôt.

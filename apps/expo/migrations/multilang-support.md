# Plan : Support Bilingue des Bases de Données

## Résumé Exécutif

### Objectif

Permettre l'accès aux ressources bibliques (lexique Strong, dictionnaire Westphal, thématique Nave, timeline, références croisées) en français ET en anglais dans la même session, sans redémarrage de l'app ni suppression de données.

### Statut Global : ✅ TERMINÉ

| Phase | Description | Statut |
|-------|-------------|--------|
| Phase 1 | Types et Infrastructure des Chemins | ✅ Fait |
| Phase 2 | Système de Migration | ✅ Fait |
| Phase 3 | Refactoring Système BDD | ✅ Fait |
| Phase 4 | État Redux | ✅ Fait |
| Phase 5 | Interface Utilisateur | ✅ Fait |
| Phase 6 | Composants waitFor* | ✅ Fait |
| Phase 7 | Caches Mémoire | ✅ Fait |
| Phase 8 | Vérification Loaders | ✅ Fait |
| Phase 9 | Écran Téléchargements | ✅ Fait |
| Phase 10 | INTERLINEAIRE | ✅ Fait |
| Phase 11 | Exclusion MHY anglais | ✅ Fait |
| Phase 12 | Bug fix INTERLINEAIRE | ✅ Fait |
| Phase 13 | Menu langue + Snackbar | ✅ Fait |

### Fichiers Créés

- `src/helpers/databaseTypes.ts` - Types et constantes pour les BDD
- `src/helpers/databaseMigration.ts` - Migration vers dossiers par langue
- `src/common/LanguageMenuOption.tsx` - Option menu pour changer la langue

### Fichiers Modifiés (principaux)

- `src/helpers/databases.ts` - Chemins par langue
- `src/helpers/firebase.ts` - URLs Firebase par langue
- `src/helpers/sqlite.ts` - DBManager avec gestion par langue
- `src/helpers/getSQLTransaction.ts` - Wrappers SQL avec langue
- `src/helpers/storage.ts` - Hook migration
- `src/redux/modules/user.ts` - État resourcesLanguage
- `src/redux/migrations.ts` - Migration 30
- `App.tsx` - Ajout migration au démarrage
- `src/common/waitFor*.tsx` - Tous les HOC (Strong, Nave, Dictionnaire, Timeline, Tresor)
- `src/features/search/waitForIndex.tsx` - HOC recherche
- `src/features/settings/DownloadsScreen.tsx` - Sections FR/EN
- `src/features/settings/ResourceLanguageScreen.tsx` - Nouveau design
- Tous les écrans de ressources (Strong, Lexique, Dictionary, Nave, Timeline, Search, Concordance)
- `i18n/locales/fr/translation.json` et `en/translation.json`

### Fichiers Supprimés

- `src/common/ResourceLanguageToggle.tsx` - Remplacé par LanguageMenuOption

---

## Décisions de conception

- **Structure dossiers** : `SQLite/fr/` et `SQLite/en/` pour les BDD par langue, `SQLite/shared/` pour TRESOR (références croisées partagées)
- **Langue par ressource** : Chaque ressource peut avoir sa propre langue (stockée dans Redux)
- **Reset au changement de langue UI** : Quand l'utilisateur change la langue de l'app, toutes les préférences de langue des ressources sont réinitialisées à la nouvelle langue
- **Persistance** : Les choix de langue par ressource sont persistés et restaurés à la prochaine session (tant que la langue UI ne change pas)
- **Téléchargement proposé** : Les HOC waitFor* proposent automatiquement le téléchargement si la BDD n'existe pas

## Architecture cible des fichiers

```
${documentDirectory}/
  SQLite/
    fr/
      strong.sqlite
      dictionnaire.sqlite
      nave.sqlite
      mhy.sqlite
      interlineaire.sqlite
    en/
      strong.sqlite
      dictionnaire.sqlite
      nave.sqlite
      mhy.sqlite
      interlineaire.sqlite
    shared/
      commentaires-tresor.sqlite
  fr/
    bible-timeline-events.json
    idx-light.json
  en/
    bible-timeline-events.json
    idx-light.json
```

---

## Phase 1 : Types et Infrastructure des Chemins ✅

### 1.1 Créer `src/helpers/databaseTypes.ts` (nouveau fichier) ✅

Types pour ResourceLanguage, DatabaseId, et constantes LANGUAGE_SPECIFIC_DBS / SHARED_DBS.

### 1.2 Modifier `src/helpers/databases.ts` ✅

- Ajouter `getSqliteDirPath(lang)` et `getDbPath(dbId, lang)`
- Modifier `databases()` pour accepter un paramètre `lang` optionnel

### 1.3 Modifier `src/helpers/firebase.ts` ✅

- Ajouter `getDatabaseUrl(dbId, lang)` unifiant databasesRef et databasesEnRef

---

## Phase 2 : Système de Migration (via App.tsx) ✅

### 2.1 Créer `src/helpers/databaseMigration.ts` ✅

Fonction `migrateToLanguageFolders(lang)` qui déplace les BDD existantes vers les sous-dossiers par langue.

### 2.2 Modifier `src/helpers/storage.ts` ✅

Ajouter un hook `useMigrateToLanguageFolders()` suivant le même pattern que les autres migrations :

- Flag MMKV `hasMigratedToLanguageFolders`
- Appel de `migrateToLanguageFolders()` si pas déjà fait

### 2.3 Modifier `App.tsx` ✅

Dans `useAppLoad()`, ajouter la migration **avant** `checkDatabasesStorage()` :

```typescript
const hasMigratedToLanguageFolders = useMigrateToLanguageFolders()
// ...
const isCompleted =
  isLoadingCompleted &&
  hasMigratedFromAsyncStorage &&
  hasMigratedFromFileSystem &&
  hasMigratedToLanguageFolders
```

### 2.4 Modifier `src/redux/migrations.ts` ✅

Migration 30 qui initialise uniquement `resourceLanguage` dans le state (sans appel async).

---

## Phase 3 : Refactoring du Système de Base de Données ✅

### 3.1 Modifier `src/helpers/sqlite.ts` ✅

Créer `DBManager` pour gérer les instances par langue avec méthodes `getDB(dbId, lang)` et `closeLanguageDatabases(lang)`.

### 3.2 Modifier `src/helpers/getSQLTransaction.ts` ✅

Les wrappers SQL utilisent `getResourceLanguage(store.getState())` pour obtenir la langue courante.

---

## Phase 4 : État Redux pour la Langue des Ressources ✅

### 4.1 Modifier `src/redux/modules/user.ts` ✅

Ajouter un état par ressource :

```typescript
interface UserState {
  // ... existant
  resourcesLanguage: {
    STRONG: ResourceLanguage
    DICTIONNAIRE: ResourceLanguage
    NAVE: ResourceLanguage
    MHY: ResourceLanguage
    TIMELINE: ResourceLanguage
    SEARCH: ResourceLanguage
    // TRESOR et INTERLINEAIRE sont partagés, pas besoin de langue
  }
}
```

Actions à créer :

- `SET_RESOURCE_LANGUAGE(dbId, lang)` - Change la langue d'une ressource spécifique
- `RESET_ALL_RESOURCES_LANGUAGE(lang)` - Remet toutes les ressources à une langue (appelé au changement de langue UI)

Sélecteurs :

- `getResourceLanguage(state, dbId): ResourceLanguage` - Obtient la langue d'une ressource
- `getAllResourcesLanguages(state)` - Obtient toutes les langues

### 4.2 Modifier le changement de langue UI ✅

Dans `MoreScreen.tsx`, quand l'utilisateur change la langue de l'app :

```typescript
// Dispatch reset de toutes les langues de ressources à la nouvelle langue
dispatch(resetAllResourcesLanguage(newLang))
```

---

## Phase 5 : Interface Utilisateur ✅

### 5.1 Créer un composant `ResourceLanguageToggle.tsx` ✅

Composant réutilisable : petit toggle FR/EN à placer dans le header de chaque écran de ressource.

### 5.2 Ajouter le toggle dans le header de chaque écran de ressource ✅

Les toggles FR/EN dans les headers permettent à l'utilisateur de personnaliser la langue de chaque ressource individuellement.

Écrans modifiés :

- `LexiqueTabScreen.tsx` (Strong) ✅
- `DictionaryTabScreen.tsx` (Westphal) ✅
- `NaveTabScreen.tsx` (Nave) ✅
- `TimelineHomeScreen.tsx` (Timeline) ✅
- `SearchTabScreen.tsx` (Recherche) ✅
- `StrongTabScreen.tsx` ✅
- `DictionaryDetailTabScreen.tsx` ✅
- `NaveDetailTabScreen.tsx` ✅
- `ConcordanceByBookScreen.tsx` ✅

### 5.3 Modifier `src/features/settings/ResourceLanguageScreen.tsx` ✅

**Renommer la page** : "Changer la langue" (au lieu de "Langue des ressources")

**Section unique - Langue globale avec deux gros boutons :**

- Bouton **Français** et bouton **English**
- Un seul bouton sélectionné à la fois (celui de la langue actuelle)
- Au clic :
  1. Change la langue i18n de l'interface (`i18n.changeLanguage()`)
  2. Réinitialise toutes les langues de ressources (`resetAllResourcesLanguage()`)
  3. Change la version biblique par défaut (LSG pour FR, KJV pour EN)
  4. **PAS de suppression de BDD** (plus nécessaire avec le système bilingue)
  5. **PAS de redémarrage** (plus nécessaire)

**Supprimer** :

- La section "Tout mettre en français / anglais"
- La liste des ressources individuelles (plus de personnalisation par ressource)

### 5.4 Modifier `src/features/settings/MoreScreen.tsx` ✅

- **Supprimé** le composant `ChangeLanguage` (l'ancien bouton qui redémarrait l'app)
- **Supprimé** l'import de `deleteAllDatabases`
- **Gardé** le lien vers `ResourceLanguage`

### 5.5 Mettre à jour les traductions i18n ✅

- Renommé `resourceLanguage.title` → "Changer la langue" / "Change language"
- Mis à jour les descriptions

---

## Phase 6 : Mise à Jour des Composants waitFor* ✅

Fichiers modifiés pour utiliser `resourceLanguage` depuis Redux :

- `src/common/waitForStrongDB.tsx` ✅
- `src/common/waitForNaveDB.tsx` ✅
- `src/common/waitForDictionnaireDB.tsx` ✅
- `src/common/waitForTresorModal.tsx` ✅
- `src/common/waitForTimeline.tsx` ✅
- `src/features/search/waitForIndex.tsx` ✅

---

## Phase 7 : Gestion des Caches en Mémoire ✅

- `src/helpers/bibleStupidMemoize.ts` : Cache par langue ✅
- `src/features/search/loadIndexCache.ts` : Index par langue ✅

---

## Phase 8 : Vérification des Loaders ✅

Loaders vérifiés et fonctionnels avec les wrappers SQL mis à jour.

---

## Ordre d'Implémentation

1. Phase 1 : Types et chemins
2. Phase 2 : Migration Redux
3. Phase 4 : État Redux
4. Phase 3 : sqlite.ts et getSQLTransaction.ts
5. Phase 6 : Composants waitFor*
6. Phase 7 : Caches mémoire
7. Phase 5 : Interface utilisateur
8. Phase 8 : Vérification loaders

---

## Fichiers Critiques

| Fichier | Rôle |
|---------|------|
| `App.tsx` | Point d'entrée migration |
| `src/helpers/storage.ts` | Hook migration + flag MMKV |
| `src/helpers/databaseMigration.ts` | Logique de migration fichiers |
| `src/helpers/sqlite.ts` | DBManager, gestion instances par langue |
| `src/helpers/databases.ts` | Chemins et configuration des BDD |
| `src/helpers/getSQLTransaction.ts` | Wrappers SQL avec langue |
| `src/redux/migrations.ts` | Initialisation state resourceLanguage |
| `src/redux/modules/user.ts` | État resourceLanguage |
| `src/common/waitForStrongDB.tsx` | Pattern pour tous les waitFor* |

---

## Phase 9 : Écran de Téléchargement Bilingue ✅

### 9.1 Modifier `src/features/settings/DownloadsScreen.tsx` ✅

Afficher les bases de données en deux sections par langue :

```
📁 Bases de données - Français
  - Lexique Strong (FR)
  - Dictionnaire Westphal (FR)
  - Bible Thématique Nave (FR)
  - Commentaires MHY (FR)
  - Chronologie (FR)
  - Index de recherche (FR)

📁 Bases de données - English
  - Strong's Lexicon (EN)
  - Westphal Dictionary (EN)
  - Nave's Topical Bible (EN)
  - MHY Commentaries (EN)
  - Timeline (EN)
  - Search Index (EN)

📁 Références croisées (partagé)
  - TRESOR (une seule version, partagée)

📁 Bibles
  - (inchangé)
```

### 9.2 Modifier `src/features/settings/DatabaseSelectorItem.tsx` ✅

Ajouté prop `lang: ResourceLanguage` pour :

- Utiliser `getDbPath(database, lang)` pour le chemin local
- Utiliser `getDatabaseUrl(database, lang)` pour l'URL de téléchargement
- Initialiser via `dbManager.getDB(database, lang).init()` après téléchargement

### 9.3 Ajouter fonction `getIfDatabaseNeedsDownloadForLang(dbId, lang)` ✅

Dans `src/helpers/databases.ts`, créé une variante qui vérifie l'existence pour une langue spécifique.

### 9.4 Traductions i18n ✅

Ajouté :

- `downloads.databasesFr`: "Bases de données - Français"
- `downloads.databasesEn`: "Bases de données - English"
- `downloads.crossReferences`: "Références croisées"

---

## Phase 10 : Ajouter INTERLINEAIRE au système bilingue ✅

L'interlinéaire avait été oublié dans plusieurs fichiers. Ajouté partout :

### 10.1 `src/helpers/databaseTypes.ts` ✅

Ajouté `'INTERLINEAIRE'` à `USER_SELECTABLE_DBS`

### 10.2 `src/redux/modules/user.ts` ✅

Ajouté `INTERLINEAIRE: ResourceLanguage` dans `ResourcesLanguageState`

### 10.3 `src/helpers/getSQLTransaction.ts` ✅

Ajouté `'INTERLINEAIRE'` à la liste `selectableDbIds`

### 10.4 `src/features/settings/ResourceLanguageScreen.tsx` ✅

Ajouté INTERLINEAIRE dans `RESOURCES_CONFIG`

### 10.5 `src/redux/migrations.ts` ✅

Ajouté `INTERLINEAIRE: currentLang` dans l'initialisation de `resourcesLanguage` (migration 30)

### 10.6 Traductions i18n ✅

Ajouté `resourceLanguage.interlineaireDesc`

---

## Phase 11 : Exclure MHY de l'anglais ✅

MHY (Commentaires de Matthew Henry) n'existe qu'en français. Exclu des options anglaises.

### 11.1 `src/helpers/databaseTypes.ts` ✅

Ajouté la constante `FRENCH_ONLY_DBS`

### 11.2 `src/features/settings/DownloadsScreen.tsx` ✅

Modifié `getLanguageSpecificDatabases()` pour filtrer MHY quand `lang === 'en'`

### 11.3 `src/features/settings/ResourceLanguageScreen.tsx` ✅

MHY retiré de `RESOURCES_CONFIG`

### 11.4 Traductions i18n ✅

Nettoyé les traductions obsolètes

---

## Phase 12 : Correction bug INTERLINEAIRE dans resetAllResourcesLanguage ✅ FAIT

### 12.1 `src/redux/modules/user.ts`

Ajout de `INTERLINEAIRE: lang` dans le reducer `RESET_ALL_RESOURCES_LANGUAGE`.

---

## Phase 13 : Menu de sélection de langue avec Snackbar ✅

### Objectif

Interface simple : toggle dans le menu PopOver avec confirmation Snackbar.

### État actuel ✅

- `LanguageMenuOption.tsx` fait un toggle direct FR↔EN avec Snackbar de confirmation
- Tous les écrans utilisent `PopOverMenu` + `LanguageMenuOption`
- `ResourceLanguageToggle.tsx` supprimé

### 13.1 `LanguageMenuOption.tsx` ✅

**Fichier:** `src/common/LanguageMenuOption.tsx`

Comportement final :

- Affiche "Langue: Français" ou "Langue: English" dans le menu
- Au clic, toggle la langue et affiche un Snackbar "Langue de la ressource changée en {langue}"

### 13.2 Traductions i18n ✅

- `menu.language`: "Langue" / "Language"
- `menu.languageChanged`: "Langue de la ressource changée en {{language}}" / "Resource language changed to {{language}}"

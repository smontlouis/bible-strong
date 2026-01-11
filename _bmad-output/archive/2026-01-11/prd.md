---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - "_bmad-output/project-planning-artifacts/product-brief-bible-strong-app-2026-01-06.md"
  - "docs/index.md"
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 1
workflowType: 'prd'
lastStep: 11
project_name: 'bible-strong-app'
user_name: 'Stephane'
date: '2026-01-06'
---

# Product Requirements Document - bible-strong-app

**Author:** Stephane
**Date:** 2026-01-06

## Executive Summary

### Vision

Moderniser l'infrastructure de navigation de Bible Strong en migrant de React Navigation 6 vers Expo Router, afin de débloquer le deep linking natif pour les campagnes marketing et le partage, tout en adoptant les nouvelles fonctionnalités de l'écosystème Expo (context menus, dropdown menus, etc.).

Cette migration technique permettra :
- **Deep linking automatique** : Chaque écran devient accessible via URL, permettant des liens directs vers des Bibles, plans de lecture, et ressources spécifiques
- **Campagnes marketing** : Capacité de créer des liens de campagne traçables pour acquisition utilisateur
- **Partage amélioré** : Les utilisateurs pourront partager des liens directs vers du contenu spécifique
- **Features modernes** : Accès aux nouvelles fonctionnalités d'Expo Router (context menus, dropdown menus, etc.)
- **Maintenance simplifiée** : Routing basé sur fichiers, plus intuitif et maintenable

### Ce qui rend cette migration spéciale

Bible Strong possède une architecture de navigation unique avec un système multi-onglets custom géré par Jotai, permettant d'avoir plusieurs instances de Bible ouvertes simultanément. La migration doit préserver cette fonctionnalité différenciante tout en ajoutant :

1. **URLs sémantiques** : `/bible/LSG/jean/3/16`, `/plan/yearly-bible/day-42`, `/strong/H1234`
2. **Liens de campagne** : Support pour UTM parameters et tracking
3. **Partage natif** : Intégration avec les fonctionnalités de partage système
4. **Navigation moderne** : Context menus, dropdown menus, gestures améliorées

## Project Classification

| Critère | Valeur |
|---------|--------|
| **Type technique** | Mobile App (React Native/Expo) |
| **Domaine** | General (Application religieuse/éducative) |
| **Complexité** | Medium |
| **Contexte** | Brownfield - refactoring système existant |

### Scope technique

- **45+ routes** à migrer vers structure file-based
- **Système multi-onglets** Jotai à adapter
- **Paramètres de navigation** à refactorer (sérialisation)
- **Deep linking** à configurer pour iOS/Android
- **Nouvelles features** Expo Router à intégrer

## Success Criteria

### Technical Success

| Critère | Définition | Validation |
|---------|------------|------------|
| **Zéro régression** | Toutes les fonctionnalités existantes marchent identiquement | Test manuel exhaustif |
| **Migration complète** | 45+ routes migrées vers structure file-based | Aucun fichier dans `src/navigation/` |
| **Deep linking ready** | Infrastructure URL en place | Liens testables sur iOS/Android |
| **Build stable** | Compilation sans erreur iOS/Android | `yarn build:ios:prod` + `yarn build:android:prod` |
| **TypeScript clean** | Pas de nouvelles erreurs de type | `yarn typecheck` passe |

### Validation Checklist

**Navigation core :**
- [ ] Lecture Bible (tous les onglets)
- [ ] Système multi-onglets (création, switch, fermeture)
- [ ] Navigation entre écrans (push, pop, modal)
- [ ] Back button/gesture fonctionne

**Features critiques :**
- [ ] Recherche Bible et Strong
- [ ] Plans de lecture
- [ ] Notes et highlights
- [ ] Dictionnaire et Nave
- [ ] Paramètres et compte

**Deep linking :**
- [ ] Scheme URL configuré (biblestrong://)
- [ ] Universal links configurés (iOS)
- [ ] App links configurés (Android)

### Measurable Outcomes

| Métrique | Avant | Après | Acceptable |
|----------|-------|-------|------------|
| Temps de build | Baseline | ≤ Baseline | Pas de dégradation |
| Taille bundle | Baseline | ≤ +5% | Légère augmentation OK |
| Crash rate | Baseline | ≤ Baseline | Pas de nouveaux crashs |

## Product Scope

### MVP - Migration Complète

**Inclus :**
- Conversion de toutes les routes vers `app/` directory
- Remplacement de `navigation.navigate()` par `router.push()`
- Migration des params vers `useLocalSearchParams()`
- Suppression de `NavigationContainer`
- Configuration deep linking de base

**Exclus (post-migration) :**
- URLs sémantiques avancées (`/bible/LSG/jean/3/16`)
- Context menus et dropdown menus
- Tracking UTM pour campagnes
- Features de partage avancées

### Growth Features (Post-MVP)

- Deep links sémantiques pour Bible, plans, Strong
- Intégration context menus Expo Router
- Partage natif avec previews
- Analytics sur deep links

### Vision (Future)

- Campagnes marketing avec liens traçables
- Partage social avec rich previews
- Web version possible (Expo Router web support)

## User Impact

> **Note :** Cette migration est transparente pour les utilisateurs finaux. Aucun changement de comportement visible - l'expérience reste identique. Les bénéfices utilisateurs (deep linking, partage) viendront dans des features post-migration.

## Technical Requirements - Migration Expo Router

### Principes de migration

| Principe | Description |
|----------|-------------|
| **1:1 Migration** | Reproduire exactement le comportement actuel |
| **Pas de refacto** | Ne pas changer l'architecture métier |
| **Système tabs intact** | Garder Jotai pour la gestion multi-onglets |
| **Modals inchangées** | Conserver les modals React Native existantes |

### Structure cible `app/`

```
app/
├── _layout.tsx              # Root layout (Stack simple, pas de tabs)
├── index.tsx                # → export AppSwitcherScreen (gère "tabs" en interne)
├── bible/
│   └── [...].tsx            # → export from ~features/bible/BibleScreen
├── strong/
│   └── [id].tsx             # → export from ~features/dictionnary/StrongScreen
├── plan/
│   └── [...].tsx            # → export from ~features/plans/...
├── settings.tsx             # → export from ~features/settings/SettingsScreen
├── study/
│   └── [...].tsx            # → export from ~features/studies/...
└── [autres routes...]       # Tous des exports simples vers src/features/
```

**Pattern des fichiers route :**
```typescript
// app/strong/[id].tsx
export { default } from '~features/dictionnary/StrongScreen'
```

### Mapping de migration

| React Navigation 6 | Expo Router |
|--------------------|-------------|
| `NavigationContainer` | Supprimé (géré par Expo) |
| `createNativeStackNavigator()` | `Stack` depuis `expo-router` |
| `navigation.navigate('Screen', {params})` | `router.push('/screen?param=value')` |
| `navigation.goBack()` | `router.back()` |
| `navigation.replace()` | `router.replace()` |
| `useNavigation()` | `useRouter()` |
| `route.params` | `useLocalSearchParams()` |

### Fichiers impactés

| Catégorie | Fichiers | Action |
|-----------|----------|--------|
| **Navigation config** | `MainStackNavigator.tsx` | Supprimer, remplacer par `app/_layout.tsx` |
| **Types navigation** | `navigation/type.ts` | Adapter pour typed routes Expo Router |
| **Tous les screens** | 45+ fichiers | Remplacer imports navigation |
| **Entry point** | `App.tsx`, `InitApp.tsx` | Retirer NavigationContainer |

### Ce qui ne change PAS

- `src/state/tabs.ts` - Système multi-onglets Jotai
- `src/redux/` - Store Redux et middleware
- `src/features/*/` - Logique métier des features
- Modals React Native existantes
- WebView Bible et interactions

## Functional Requirements

### Navigation Core

- FR1: L'utilisateur peut naviguer entre tous les écrans existants via Expo Router (Stack)
- FR2: L'utilisateur peut utiliser le bouton/geste back pour revenir à l'écran précédent
- FR3: Le système peut gérer les routes dynamiques (bible/[version], strong/[id], etc.)

### AppSwitcher (Navigation principale)

- FR4: AppSwitcherScreen gère les "tabs" visuels en interne (Bible/Search/Home/Plans)
- FR5: Le système Jotai gère l'état de navigation interne à AppSwitcher (inchangé)
- FR6: L'utilisateur peut basculer entre les vues via l'UI AppSwitcher (inchangé)

### Système Multi-Onglets Bible

- FR7: L'utilisateur peut ouvrir plusieurs onglets Bible simultanément (Jotai, inchangé)
- FR8: L'utilisateur peut basculer entre les onglets Bible ouverts
- FR9: L'utilisateur peut fermer un onglet Bible
- FR10: Le système persiste l'état des onglets entre sessions

### Deep Linking (Infrastructure)

- FR11: Le système peut recevoir et traiter des URLs entrantes (scheme biblestrong://)
- FR12: Le système peut router vers l'écran approprié depuis une URL
- FR13: Le système peut extraire les paramètres d'URL et les passer à l'écran cible
- FR14: Le système peut gérer les Universal Links (iOS) et App Links (Android)

### Paramètres de Navigation

- FR15: Les écrans peuvent recevoir des paramètres via useLocalSearchParams()
- FR16: Les paramètres complexes sont sérialisés/désérialisés correctement

### Structure de Code

- FR17: Les fichiers dans `app/` contiennent uniquement l'import/export du screen
- FR18: La logique des screens reste dans `src/features/`
- FR19: Les path aliases (~features/) fonctionnent depuis `app/`

### Préservation des Features

- FR20: Toutes les fonctionnalités existantes restent fonctionnelles après migration

## Non-Functional Requirements

### Performance

| NFR | Critère | Mesure |
|-----|---------|--------|
| NFR1 | Temps de navigation entre écrans | ≤ temps actuel |
| NFR2 | Temps de démarrage de l'app | ≤ temps actuel |
| NFR3 | Utilisation mémoire | ≤ utilisation actuelle |
| NFR4 | Taille du bundle | ≤ +5% vs actuel |

### Compatibilité

| NFR | Critère | Mesure |
|-----|---------|--------|
| NFR5 | iOS minimum supporté | iOS 13+ (inchangé) |
| NFR6 | Android minimum supporté | API 21+ (inchangé) |
| NFR7 | Expo SDK compatible | SDK 54 |

### Fiabilité

| NFR | Critère | Mesure |
|-----|---------|--------|
| NFR8 | Crash rate | ≤ baseline actuel |
| NFR9 | Deep links fonctionnels | 100% des routes testées |
| NFR10 | Back navigation | Fonctionne sur tous les écrans |

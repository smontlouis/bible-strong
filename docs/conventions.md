# Conventions et Patterns - Bible Strong

> Généré automatiquement le 2026-01-06

## Conventions de code

### Structure des fichiers

```typescript
// 1. Imports externes
import React from 'react'
import { View } from 'react-native'
import styled from '@emotion/native'

// 2. Imports internes (avec aliases)
import { Button } from '~common/ui/Button'
import { useTheme } from '~themes'

// 3. Types locaux
interface Props {
  title: string
}

// 4. Composant principal
const MyComponent = ({ title }: Props) => {
  // hooks en premier
  const theme = useTheme()

  // puis logique
  const handlePress = () => { /* ... */ }

  // enfin le rendu
  return (
    <Container>
      <Title>{title}</Title>
    </Container>
  )
}

// 5. Styled components
const Container = styled.View(({ theme }) => ({
  flex: 1,
  backgroundColor: theme.colors.lightGrey,
}))

const Title = styled.Text({
  fontSize: 16,
})

// 6. Export
export default MyComponent
```

### Naming conventions

| Type | Convention | Exemple |
|------|------------|---------|
| Composants | PascalCase | `BibleViewer.tsx` |
| Hooks | camelCase avec `use` | `useBibleTabActions` |
| Utils/Helpers | camelCase | `formatVerseContent.ts` |
| Types/Interfaces | PascalCase | `BibleTab`, `UserState` |
| Constants | UPPER_SNAKE_CASE | `MAX_TAB_GROUPS` |
| Atoms Jotai | camelCase avec `Atom` | `tabGroupsAtom` |
| Actions Redux | UPPER_SNAKE_CASE | `ADD_HIGHLIGHT` |

### Path aliases

Toujours utiliser les aliases au lieu des chemins relatifs :

```typescript
// Correct
import { Button } from '~common/ui/Button'
import { useBibleTabActions } from '~state/tabs'

// Éviter
import { Button } from '../../../common/ui/Button'
```

| Alias | Chemin |
|-------|--------|
| `~assets` | `src/assets` |
| `~common` | `src/common` |
| `~features` | `src/features` |
| `~helpers` | `src/helpers` |
| `~navigation` | `src/navigation` |
| `~redux` | `src/redux` |
| `~themes` | `src/themes` |
| `~state` | `src/state` |
| `~i18n` | `i18n` |

## Patterns React

### React Compiler - Pas de memoization manuelle

Le projet utilise React Compiler. **NE PAS utiliser** :

```typescript
// INTERDIT - React Compiler gère automatiquement
const memoizedValue = useMemo(() => expensiveCalculation(a, b), [a, b])
const memoizedCallback = useCallback(() => handleClick(id), [id])
const MemoizedComponent = memo(MyComponent)

// CORRECT - Écrire normalement
const value = expensiveCalculation(a, b)
const handleClick = () => { /* ... */ }
const MyComponent = () => { /* ... */ }
```

### Composants de layout

Préférer `Box`, `HStack`, `VStack` à `StyleSheet` :

```typescript
// CORRECT - Composants de layout
import { Box, HStack, VStack } from '~common/ui'

<HStack flex={1} p={16} gap={8}>
  <Box flex={1} bg="primary">
    <Text>Content</Text>
  </Box>
</HStack>

// ÉVITER - StyleSheet pour le layout
const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', padding: 16 }
})
```

### Props de style disponibles

| Prop | CSS Property |
|------|--------------|
| `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl` | padding |
| `m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml` | margin |
| `flex` | flex |
| `bg` | backgroundColor |
| `gap` | gap |
| `row` | flexDirection: 'row' |
| `center` | alignItems + justifyContent: 'center' |

### Styled Components (Emotion)

```typescript
// Avec accès au thème
const Container = styled.View(({ theme }) => ({
  backgroundColor: theme.colors.lightGrey,
  padding: theme.spacing.md,
}))

// Sans thème (styles statiques)
const Title = styled.Text({
  fontSize: 16,
  fontWeight: 'bold',
})

// Avec props conditionnelles
const Button = styled.TouchableOpacity<{ primary?: boolean }>(
  ({ theme, primary }) => ({
    backgroundColor: primary ? theme.colors.primary : theme.colors.grey,
    padding: 12,
    borderRadius: 8,
  })
)
```

## Patterns d'état

### Quand utiliser Redux vs Jotai

| Utiliser Redux | Utiliser Jotai |
|----------------|----------------|
| Données persistantes | État UI éphémère |
| Sync avec Firestore | État local de composant |
| Données partagées globalement | État des onglets |
| Bookmarks, highlights, notes, settings | Modals, formulaires, animations |

### Pattern Redux avec Immer

```typescript
// Reducer avec produce d'Immer
import produce, { Draft } from 'immer'

const userReducer = produce((draft: Draft<UserState>, action) => {
  switch (action.type) {
    case ADD_HIGHLIGHT: {
      const { verseId, color } = action.payload
      draft.bible.highlights[verseId] = {
        color,
        tags: {},
        date: Date.now(),
      }
      break
    }
  }
})
```

### Pattern Jotai avec persistence

```typescript
// Atom persisté
export const tabGroupsAtom = atomWithAsyncStorage<TabGroup[]>(
  'tabGroupsAtom',           // Clé de stockage
  [createDefaultGroup()],    // Valeur par défaut
  { migrate: migrateTabGroups } // Migration optionnelle
)

// Atom dérivé
export const activeGroupAtom = atom(get => {
  const groups = get(tabGroupsAtom)
  const activeId = get(activeGroupIdAtom)
  return groups.find(g => g.id === activeId) || groups[0]
})

// Atom avec setter personnalisé
export const tabsAtom = atom(
  get => get(activeGroupAtom).tabs,
  (get, set, newTabs: TabItem[]) => {
    const groups = get(tabGroupsAtom)
    const activeId = get(activeGroupIdAtom)
    set(tabGroupsAtom, groups.map(g =>
      g.id === activeId ? { ...g, tabs: newTabs } : g
    ))
  }
)
```

### Hook d'actions pour onglets Bible

```typescript
// Utilisation du hook
const tabAtom = useAtomValue(tabsAtomsAtom)[activeTabIndex]
const actions = useBibleTabActions(tabAtom)

// Actions disponibles
actions.setSelectedVersion('LSG')
actions.setSelectedBook({ Numero: 1, Nom: 'Genèse', Chapitres: 50 })
actions.goToNextChapter()
actions.addSelectedVerse('1-1-1')
actions.clearSelectedVerses()
```

## Patterns Reanimated 4

### CSS Transitions (préféré pour animations simples)

```typescript
// Animation basée sur l'état
<Animated.View
  style={{
    opacity: isVisible ? 1 : 0,
    transform: [{ scale: isExpanded ? 1.2 : 1 }],
    transitionProperty: ['opacity', 'transform'],
    transitionDuration: 300,
    transitionTimingFunction: 'ease-out',
  }}
/>
```

### SharedValue (pour gestures/scroll)

```typescript
// Avec la nouvelle API .get()/.set()
const scrollX = useSharedValue(0)

const animatedStyle = useAnimatedStyle(() => ({
  opacity: interpolate(
    scrollX.get(),
    [0, 100],
    [0, 1],
    Extrapolation.CLAMP
  ),
}))

// Mise à jour
scrollX.set(100)
scrollX.set(v => v + 50)  // Avec callback
```

## Patterns de navigation

### Navigation typée

```typescript
// Définition des types (navigation/type.ts)
export type MainStackProps = {
  AppSwitcher: undefined
  BibleView: { book?: number; chapter?: number }
  Strong: { reference: string }
  // ...
}

// Utilisation
import { useNavigation } from '@react-navigation/native'
import { MainStackProps } from '~navigation/type'

const navigation = useNavigation<NavigationProp<MainStackProps>>()

navigation.navigate('Strong', { reference: 'H1234' })
```

### Navigation depuis un onglet

```typescript
// Ouvrir dans un nouvel onglet
const setTabs = useSetAtom(tabsAtom)
const setActiveIndex = useSetAtom(activeTabIndexAtom)

const openInNewTab = (tabData: Partial<StrongTab>) => {
  setTabs(prev => [...prev, {
    id: `strong-${Date.now()}`,
    type: 'strong',
    title: 'Lexique',
    isRemovable: true,
    data: tabData.data || {},
  }])
  setActiveIndex(prev => prev + 1)
}
```

## Patterns Firebase

### Sync Firestore via middleware

```typescript
// Le middleware intercepte automatiquement ces actions
dispatch(addHighlight({ verseId: '1-1-1', color: 'color-69D2E7' }))

// Flux interne:
// 1. Reducer met à jour state.user.bible.highlights
// 2. firestoreMiddleware détecte le diff
// 3. batchWriteSubcollection écrit dans Firestore
```

### Requête SQLite

```typescript
import { getDatabases } from '~helpers/databases'
import { getSQLTransaction } from '~helpers/getSQLTransaction'

const loadVerses = async (book: number, chapter: number) => {
  const db = getDatabases().BIBLE
  const tx = await getSQLTransaction(db)

  const result = await tx.executeSql(
    'SELECT * FROM verses WHERE book = ? AND chapter = ?',
    [book, chapter]
  )

  return result.rows._array
}
```

## Patterns i18n

### Utilisation des traductions

```typescript
import { useTranslation } from 'react-i18next'

const MyComponent = () => {
  const { t } = useTranslation()

  return (
    <View>
      <Text>{t('common.save')}</Text>
      <Text>{t('bible.verse', { count: 5 })}</Text>
    </View>
  )
}
```

### Structure des fichiers de traduction

```json
// i18n/locales/fr/translation.json
{
  "common": {
    "save": "Enregistrer",
    "cancel": "Annuler"
  },
  "bible": {
    "verse": "{{count}} verset",
    "verse_plural": "{{count}} versets"
  }
}
```

## Anti-patterns à éviter

### 1. Mutation directe de l'état

```typescript
// INTERDIT
state.user.highlights['1-1-1'] = { color: 'red' }

// CORRECT - Via dispatch
dispatch(addHighlight({ verseId: '1-1-1', color: 'red' }))
```

### 2. Chemins relatifs profonds

```typescript
// INTERDIT
import { Button } from '../../../common/ui/Button'

// CORRECT
import { Button } from '~common/ui/Button'
```

### 3. useMemo/useCallback/memo

```typescript
// INTERDIT (React Compiler gère)
const memoized = useMemo(() => compute(), [deps])

// CORRECT
const value = compute()
```

### 4. StyleSheet pour les layouts

```typescript
// ÉVITER
<View style={styles.container}>

// PRÉFÉRER
<Box flex={1} p={16}>
```

### 5. Navigation non typée

```typescript
// ÉVITER
navigation.navigate('SomeScreen', { data: 'abc' })

// PRÉFÉRER - Avec types
navigation.navigate<'SomeScreen'>('SomeScreen', { data: 'abc' })
```

## Checklist avant PR

- [ ] Pas de `useMemo`, `useCallback`, `memo()`
- [ ] Aliases utilisés pour les imports
- [ ] Types TypeScript complets
- [ ] Composants de layout (`Box`, `HStack`, `VStack`)
- [ ] Pas de mutations directes d'état
- [ ] Traductions pour tout texte visible
- [ ] Tests pour la logique critique
- [ ] `yarn lint` passe
- [ ] `yarn typecheck` passe

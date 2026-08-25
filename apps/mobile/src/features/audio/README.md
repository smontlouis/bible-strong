# Feature Audio

## Vue d'ensemble

La feature Audio offre deux modes de lecture audio pour la Bible : Text-to-Speech (TTS) natif et lecture de fichiers audio distants. Elle fournit une interface complète avec contrôles avancés, synchronisation avec le texte et support multi-onglets.

## Fonctionnalités principales

### Deux modes de lecture
- **Mode TTS** : Synthèse vocale native avec Expo Speech
- **Mode URL** : Lecture de fichiers audio MP3 distants

### Contrôles avancés
- Lecture/Pause avec synchronisation texte
- Contrôle de vitesse (0.5x à 2x)
- Répétition (verset, chapitre, livre)
- Minuterie de sommeil
- Navigation entre versets/chapitres
- Mode plein écran

### Synchronisation
- Suivi du verset en cours de lecture
- Navigation automatique entre chapitres
- Défilement automatique du texte
- Multi-onglets avec un seul lecteur actif

## Architecture

### Structure des composants

```
audio/
├── AudioContainer.tsx       # Container principal avec états
├── AudioTTSFooter.tsx      # Interface TTS complète
├── AudioUrlFooter.tsx      # Interface lecteur audio URL
├── Components/
│   ├── PlayButton.tsx      # Bouton play/pause animé
│   ├── SpeedButton.tsx     # Sélecteur de vitesse
│   ├── RepeatButton.tsx    # Modes de répétition
│   ├── SleepButton.tsx     # Minuterie de sommeil
│   ├── VoiceButton.tsx     # Sélection voix TTS
│   ├── PitchButton.tsx     # Hauteur de voix TTS
│   └── ExpandButton.tsx    # Toggle mode plein écran
└── atom.ts                 # État global Jotai
```

### État global (Jotai)

```typescript
interface AudioSettings {
  speed: number           // 0.5 à 2.0
  voice?: string          // ID de la voix TTS
  pitch: number          // 0.5 à 2.0
  repeat: RepeatMode     // 'verse' | 'chapter' | 'book'
  sleepTimer?: number    // Minutes avant arrêt
  isExpanded: boolean    // Mode plein écran
}

type RepeatMode = 'verse' | 'chapter' | 'book' | 'off'
```

## Mode Text-to-Speech (TTS)

### Configuration Expo Speech

```typescript
import * as Speech from 'expo-speech'

// Initialisation
const speak = async (text: string, options: SpeechOptions) => {
  await Speech.speak(text, {
    language: 'fr-FR',
    pitch: settings.pitch,
    rate: settings.speed,
    voice: settings.voice,
    onDone: () => nextVerse(),
    onError: (error) => handleError(error)
  })
}
```

### Gestion iOS Silent Mode

```typescript
// Hack pour activer l'audio en mode silencieux
const enableAudioInSilentMode = async () => {
  const { sound } = await Audio.Sound.createAsync(
    require('./silence.mp3'),
    { shouldPlay: true, isLooping: true, volume: 0 }
  )
  // Garde la référence pour cleanup
}
```

### Navigation automatique

```typescript
const playNextVerse = () => {
  const nextVerse = getNextVerse(currentVerse)
  
  if (!nextVerse && settings.repeat === 'chapter') {
    // Recommencer le chapitre
    playVerse(firstVerseOfChapter)
  } else if (!nextVerse) {
    // Chapitre suivant
    navigateToNextChapter()
  } else {
    playVerse(nextVerse)
  }
}
```

## Mode URL (Audio Files)

### Configuration Track Player

```typescript
import TrackPlayer from 'react-native-track-player'

// Setup initial
await TrackPlayer.setupPlayer({
  capabilities: [
    Capability.Play,
    Capability.Pause,
    Capability.SkipToNext,
    Capability.SkipToPrevious,
    Capability.SeekTo
  ]
})

// Ajout des pistes
const tracks = chapters.map(chapter => ({
  id: `${book}-${chapter}`,
  url: getAudioUrl(book, chapter, version),
  title: `${bookName} ${chapter}`,
  artist: 'Bible Audio'
}))
```

### Synchronisation avec le texte

```typescript
// Listener de progression
TrackPlayer.addEventListener(Event.PlaybackProgress, (data) => {
  const currentTime = data.position
  const currentVerse = findVerseAtTime(currentTime, timestamps)
  
  if (currentVerse !== activeVerse) {
    highlightVerse(currentVerse)
    scrollToVerse(currentVerse)
  }
})
```

### Gestion de la file de lecture

```typescript
// Charger tous les chapitres d'un livre
const loadBookAudio = async (book: number) => {
  const chapters = getBookChapters(book)
  const tracks = await Promise.all(
    chapters.map(ch => createTrack(book, ch))
  )
  
  await TrackPlayer.reset()
  await TrackPlayer.add(tracks)
  await TrackPlayer.skip(currentChapter - 1)
}
```

## Interface utilisateur

### Mode compact

```typescript
<View style={styles.compactFooter}>
  <PlayButton isPlaying={isPlaying} onPress={togglePlay} />
  <Text>{currentVerse}</Text>
  <SpeedButton speed={speed} onChange={setSpeed} />
  <ExpandButton onPress={() => setExpanded(true)} />
</View>
```

### Mode étendu

```typescript
<View style={styles.expandedFooter}>
  <Header onClose={() => setExpanded(false)} />
  <ProgressBar current={position} total={duration} />
  <Controls>
    <PlayButton size="large" />
    <SkipButtons />
  </Controls>
  <Settings>
    <SpeedButton />
    <RepeatButton />
    <SleepButton />
    <VoiceButton /> {/* TTS only */}
  </Settings>
</View>
```

## Minuterie de sommeil

```typescript
const startSleepTimer = (minutes: number) => {
  const timer = setTimeout(() => {
    pauseAudio()
    showNotification('Audio arrêté')
  }, minutes * 60 * 1000)
  
  setSleepTimer(timer)
  setRemainingTime(minutes * 60)
  
  // Update countdown
  const countdown = setInterval(() => {
    setRemainingTime(prev => {
      if (prev <= 1) {
        clearInterval(countdown)
        return 0
      }
      return prev - 1
    })
  }, 1000)
}
```

## Modes de répétition

```typescript
enum RepeatMode {
  OFF = 'off',
  VERSE = 'verse',      // Répète le verset actuel
  CHAPTER = 'chapter',  // Répète le chapitre
  BOOK = 'book'        // Continue dans le livre
}

const handleRepeat = () => {
  switch (settings.repeat) {
    case 'verse':
      replayCurrentVerse()
      break
    case 'chapter':
      if (isLastVerse) restartChapter()
      else playNextVerse()
      break
    case 'book':
      if (isLastChapter) restartBook()
      else playNextChapter()
      break
  }
}
```

## Persistance et synchronisation

### Sauvegarde des préférences

```typescript
// Avec AsyncStorage
const saveAudioSettings = async (settings: AudioSettings) => {
  await AsyncStorage.setItem(
    '@audio_settings',
    JSON.stringify(settings)
  )
}

// Restauration au démarrage
const loadAudioSettings = async () => {
  const saved = await AsyncStorage.getItem('@audio_settings')
  return saved ? JSON.parse(saved) : defaultSettings
}
```

### Multi-onglets

```typescript
// Un seul lecteur actif
const audioTabAtom = atom<string | null>(null)

const activateAudio = (tabId: string) => {
  const currentActive = get(audioTabAtom)
  
  if (currentActive && currentActive !== tabId) {
    // Stopper l'audio de l'ancien onglet
    stopAudio(currentActive)
  }
  
  set(audioTabAtom, tabId)
}
```

## Performance

### Optimisations
- Préchargement des voix TTS au démarrage
- Cache des URLs audio
- Debounce sur les changements de vitesse
- Cleanup des ressources audio inactives

### Gestion mémoire
```typescript
// Cleanup
useEffect(() => {
  return () => {
    Speech.stop()
    TrackPlayer.reset()
    clearTimers()
  }
}, [])
```

## Configuration

### Sources audio
```typescript
const AUDIO_SOURCES = {
  LSG: 'https://audio.bible.com/fr/LSG/',
  S21: 'https://audio.bible.com/fr/S21/',
  // ...
}
```

### Voix TTS disponibles
- Détection automatique des voix système
- Filtrage par langue
- Voix par défaut selon la plateforme

## Points d'extension

Pour ajouter de nouvelles fonctionnalités :
1. Bookmarks audio avec timestamps
2. Vitesse variable par section
3. Égaliseur audio
4. Mode étude avec pauses automatiques

## Dépendances clés

- `expo-speech` : API Text-to-Speech
- `react-native-track-player` : Lecteur audio avancé
- `expo-av` : Audio API pour iOS silent mode
- `@react-native-async-storage/async-storage` : Persistance
- `jotai` : État global
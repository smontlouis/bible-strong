import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ENTITY_CARD_CATALOG_URL } from '~features/lexique/entityCards'
import { useEntityPortraitCatalog } from '~features/lexique/entityPortraitManifest'

import {
  getEntityCardView,
  parseCardCatalog,
  type CardCatalog,
  type CardLanguage,
  type PublishedCard,
} from './cardCatalog'
import { EntityCardCanvas } from './EntityCardCanvas'

// Playground (ADR-0090): every card of the published catalog drawn with Skia, to compare with the
// atlas (bible-strong.app/atlas/fr/cards). A sample of each finish, then the arrows through all.

type Sample = { label: string; find: (card: PublishedCard) => boolean }

const SAMPLES: Sample[] = [
  { label: 'Paillettes', find: card => card.entity.startsWith('Adam@') && !card.stage },
  {
    label: 'Bandes V',
    find: card => card.family === 'human' && card.stageCount > 1 && !!card.stage,
  },
  { label: 'Holo', find: card => card.family === 'divine' && !card.stage },
  {
    label: 'Holo · étape',
    find: card => card.family === 'divine' && !!card.stage && !card.scene,
  },
  { label: 'Cosmos', find: card => card.family === 'spirit' },
  { label: 'Reverse', find: card => card.family === 'idol' },
  { label: 'Grec', find: card => card.family === 'human' && card.script === 'grc' },
  { label: 'Coupé en haut', find: card => card.fadeTop },
]

const Chip = ({
  label,
  active,
  onPress,
}: {
  label: string
  active?: boolean
  onPress: () => void
}) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={{
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: active ? '#c9a457' : 'rgba(255,255,255,0.08)',
    }}
  >
    <Text style={{ color: active ? '#1a1206' : '#d8cfb6', fontSize: 13, fontWeight: '600' }}>
      {label}
    </Text>
  </Pressable>
)

export const EntityCardSpikeScreen = ({ onBack }: { onBack: () => void }) => {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const portraits = useEntityPortraitCatalog()
  const [catalog, setCatalog] = useState<CardCatalog | null | undefined>(undefined)
  const [index, setIndex] = useState(0)
  const [language, setLanguage] = useState<CardLanguage>('fr')

  useEffect(() => {
    fetch(ENTITY_CARD_CATALOG_URL)
      .then(response => response.json())
      .then(value => setCatalog(parseCardCatalog(value) ?? null))
      .catch(() => setCatalog(null))
  }, [])

  const cards = catalog?.cards ?? []
  const current = cards[index]
  const view =
    catalog && portraits && current
      ? getEntityCardView(current, catalog, portraits, language)
      : undefined
  const cardWidth = Math.min(Math.round((width - 8) / 1.28), 300)

  const move = (step: number) => {
    if (!cards.length) return
    setIndex((index + step + cards.length) % cards.length)
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0e16', paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
        <Pressable accessibilityRole="button" onPress={onBack} style={{ padding: 8 }}>
          <Text style={{ color: '#c4b991', fontSize: 16 }}>‹ Playground</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Chip label="FR" active={language === 'fr'} onPress={() => setLanguage('fr')} />
        <View style={{ width: 6 }} />
        <Chip label="EN" active={language === 'en'} onPress={() => setLanguage('en')} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginTop: 8 }}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}
      >
        {SAMPLES.map(sample => {
          const found = cards.findIndex(sample.find)
          return found < 0 ? null : (
            <Chip
              key={sample.label}
              label={sample.label}
              active={found === index}
              onPress={() => setIndex(found)}
            />
          )
        })}
      </ScrollView>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {catalog === undefined && <Text style={{ color: '#888' }}>Chargement…</Text>}
        {catalog === null && <Text style={{ color: '#f88' }}>Catalogue introuvable</Text>}
        {catalog && !portraits && <Text style={{ color: '#888' }}>Portraits…</Text>}
        {view && <EntityCardCanvas key={`${view.id}-${language}`} card={view} width={cardWidth} />}
        {catalog && portraits && current && !view && (
          <Text style={{ color: '#f88' }}>Pas de portrait pour {current.id}</Text>
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <Chip label="‹ Précédente" onPress={() => move(-1)} />
        <Text style={{ color: '#667', fontSize: 12 }}>
          {cards.length ? `${index + 1} / ${cards.length}` : ''}
        </Text>
        <Chip label="Suivante ›" onPress={() => move(1)} />
      </View>
    </View>
  )
}

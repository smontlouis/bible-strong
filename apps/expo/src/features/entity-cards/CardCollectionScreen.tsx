import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, useWindowDimensions, View } from 'react-native'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import { HStack, VStack } from '~common/ui/Box'
import Card from '~common/ui/Card'
import Container from '~common/ui/Container'
import SectionList from '~common/ui/SectionList'
import Text from '~common/ui/Text'
import { useCardCatalog } from '~features/lexique/entityCardManifest'
import { useEntityPortraitCatalog } from '~features/lexique/entityPortraitManifest'
import { buildPublicStrongEntityPath } from '~features/lexique/publicStrongRoutes'
import type { RootState } from '~redux/modules/reducer'
import { titleFontStyle } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'

import { CardAlbumTile } from './CardAlbumTile'
import { getEntityCardView, type CardLanguage, type EntityCardView } from './cardCatalog'
import { getCardAlbum, getMeetingBook, type CardAlbumFilter } from './cardCollection'
import { CardSpotlight } from './CardSpotlight'
import { isCardCollected } from './chapterCards'

const GUTTER = 20
const GAP = 10
/** A card of the album is about this wide: three on a phone, more on a larger screen. */
const TILE_WIDTH = 120
const MAX_WIDTH = 860

const FILTERS: CardAlbumFilter[] = ['all', 'found', 'missing']

/** Splits a list into rows of a given length. */
const rowsOf = <Item,>(items: Item[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  )

/**
 * The album of the collectible cards (ADR-0090), opened from the home: every card of the catalog
 * in the order of the Bible, grouped by era, those collected in their painting, the others on the
 * clay ground with only the book where their character is met, a riddle to solve while reading.
 * A collected card opens large.
 */
const CardCollectionScreen = () => {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const router = useRouter()
  const { width: windowWidth } = useWindowDimensions()
  const language: CardLanguage = i18n.language.startsWith('fr') ? 'fr' : 'en'
  const catalog = useCardCatalog()
  const portraits = useEntityPortraitCatalog()
  const collected = useSelector((state: RootState) => state.cards.collected)
  const [filter, setFilter] = useState<CardAlbumFilter>('all')
  const [opened, setOpened] = useState<EntityCardView>()

  const contentWidth = Math.min(windowWidth, MAX_WIDTH) - 2 * GUTTER
  const columns = Math.max(3, Math.floor((contentWidth + GAP) / (TILE_WIDTH + GAP)))
  const tileWidth = Math.floor((contentWidth - GAP * (columns - 1)) / columns)

  const views = new Map<string, EntityCardView>()
  if (catalog && portraits) {
    catalog.cards.forEach(card => {
      const view = getEntityCardView(card, catalog, portraits, language, {
        portrait: 'w256',
        backdrop: 'w384',
      })
      if (view) views.set(card.id, view)
    })
  }
  const album =
    catalog && portraits
      ? getCardAlbum(
          catalog,
          collected,
          language,
          filter,
          card => views.has(card.id),
          t('collection.god')
        )
      : undefined

  const header = <Header hasBackButton title={t('collection.title')} />

  if (!album) {
    return (
      <Container>
        {header}
        <Loading message={t('Chargement...')} />
      </Container>
    )
  }

  const progress = album.total ? album.found / album.total : 0
  const sections = album.eras.map(era => ({
    key: era.key,
    title: era.title,
    found: era.found,
    total: era.total,
    data: rowsOf(era.cards, columns),
  }))

  return (
    <Container>
      {header}
      <SectionList
        sections={sections}
        keyExtractor={(row, index) => `${row[0]?.id ?? index}`}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ alignSelf: 'center', width: contentWidth + 2 * GUTTER }}
        ListHeaderComponent={
          <VStack style={{ paddingHorizontal: GUTTER, paddingTop: 8, gap: 14 }}>
            <Card>
              <VStack className="p-[18px] gap-[10px]">
                <HStack className="items-baseline gap-[8px]">
                  <Text
                    className="text-[34px] leading-[40px]"
                    style={[titleFontStyle(theme), { fontVariant: ['tabular-nums'] }]}
                  >
                    {album.found}
                  </Text>
                  <Text className="text-[17px] text-grey">
                    {t('collection.ofTotal', { total: album.total })}
                  </Text>
                </HStack>
                <View
                  style={{
                    height: 8,
                    borderRadius: 999,
                    overflow: 'hidden',
                    backgroundColor: theme.colors.border,
                  }}
                >
                  <View
                    style={{
                      width: `${Math.max(progress * 100, album.found ? 2 : 0)}%`,
                      height: '100%',
                      borderRadius: 999,
                      backgroundColor: '#f2c14e',
                    }}
                  />
                </View>
                <Text className="text-[13px] text-grey">
                  {t('collection.characters', album.characters)}
                  {' · '}
                  {t('collection.stages', album.stages)}
                </Text>
              </VStack>
            </Card>
            <HStack className="gap-[8px]">
              {FILTERS.map(item => {
                const active = item === filter
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setFilter(item)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: active ? theme.colors.primary : theme.colors.lightGrey,
                    }}
                  >
                    <Text
                      className="text-[14px] font-semibold"
                      style={{ color: active ? theme.colors.reverse : theme.colors.default }}
                    >
                      {t(`collection.filters.${item}`)}
                    </Text>
                  </Pressable>
                )
              })}
            </HStack>
          </VStack>
        }
        ListEmptyComponent={<Empty message={t('collection.empty')} />}
        renderSectionHeader={({ section }) => (
          <HStack
            className="items-baseline justify-between"
            style={{ paddingHorizontal: GUTTER, paddingTop: 26, paddingBottom: 10 }}
          >
            <Text className="text-[20px]" style={titleFontStyle(theme)}>
              {section.title}
            </Text>
            <Text className="text-[13px] text-grey" style={{ fontVariant: ['tabular-nums'] }}>
              {section.found} / {section.total}
            </Text>
          </HStack>
        )}
        renderItem={({ item: row }) => (
          <HStack style={{ paddingHorizontal: GUTTER, gap: GAP, marginBottom: GAP }}>
            {row.map(card => {
              const view = views.get(card.id)
              if (!view) return null
              const has = isCardCollected(card.id, collected)
              return (
                <CardAlbumTile
                  key={card.id}
                  card={view}
                  width={tileWidth}
                  collected={has}
                  meetingBook={getMeetingBook(card, language)}
                  onPress={() =>
                    setOpened(
                      catalog && portraits
                        ? getEntityCardView(card, catalog, portraits, language)
                        : undefined
                    )
                  }
                />
              )
            })}
          </HStack>
        )}
      />
      {opened && (
        <CardSpotlight
          card={opened}
          mode="view"
          onOpenCharacter={() => {
            const entity = catalog?.cards.find(card => card.id === opened.id)?.entity
            if (entity) router.push(buildPublicStrongEntityPath(entity) as never)
          }}
          onClose={() => setOpened(undefined)}
        />
      )}
    </Container>
  )
}

export default CardCollectionScreen

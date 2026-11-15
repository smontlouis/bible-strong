import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import Empty from '~common/Empty'
import FiltersHeader, { type FiltersHeaderItem } from '~common/FiltersHeader'
import Loading from '~common/Loading'
import Box, { HStack, VStack } from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import { MenuView } from '~common/ui/MenuView'
import SectionList from '~common/ui/SectionList'
import Text from '~common/ui/Text'
import { useCardCatalog } from '~features/lexique/entityCardManifest'
import { useEntityPortraitCatalog } from '~features/lexique/entityPortraitManifest'
import { buildPublicStrongEntityPath } from '~features/lexique/publicStrongRoutes'
import { resetCards } from '~redux/modules/cards'
import type { RootState } from '~redux/modules/reducer'
import { setSettingsCardCollection } from '~redux/modules/user/settings'
import { titleFontStyle } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'

import { CardAlbumSummary } from './CardAlbumSummary'
import { CardAlbumTile } from './CardAlbumTile'
import { getEntityCardView, type CardLanguage, type EntityCardView } from './cardCatalog'
import {
  getCardAlbum,
  getFanCards,
  getMeetingBook,
  FOUND_GROUP,
  MISSING_GROUP,
  type CardAlbumFilter,
  type CardAlbumOrder,
} from './cardCollection'
import { CardSpotlight } from './CardSpotlight'
import { isCardCollected } from './chapterCards'

const GUTTER = 20
const GAP = 10
/** A card of the album is about this wide: three on a phone, more on a larger screen. */
const TILE_WIDTH = 120
const MAX_WIDTH = 860

const FILTERS: CardAlbumFilter[] = ['all', 'found', 'missing']
const ORDERS: CardAlbumOrder[] = ['bible', 'recent']

/** Splits a list into rows of a given length. */
const rowsOf = <Item,>(items: Item[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  )

/**
 * The album of the collectible cards (ADR-0090), opened from the home: every card of the catalog
 * in the order of the Bible, grouped by era, those collected in their painting, the others on the
 * clay ground with only the book where their character is met, a riddle to solve while reading.
 * A collected card opens large. Its menu sorts the album by the cards found last, turns the
 * cards off, or empties the collection to find them all again.
 */
const CardCollectionScreen = () => {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const router = useRouter()
  const dispatch = useDispatch()
  const confirm = useConfirmDialog()
  const { width: windowWidth } = useWindowDimensions()
  const language: CardLanguage = i18n.language.startsWith('fr') ? 'fr' : 'en'
  const catalog = useCardCatalog()
  const portraits = useEntityPortraitCatalog()
  const collected = useSelector((state: RootState) => state.cards.collected)
  const [filter, setFilter] = useState<CardAlbumFilter>('all')
  const [order, setOrder] = useState<CardAlbumOrder>('bible')
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
      ? getCardAlbum(catalog, collected, language, {
          filter,
          order,
          isDrawable: card => views.has(card.id),
          titles: {
            god: t('collection.god'),
            found: t('collection.filters.found'),
            missing: t('collection.filters.missing'),
          },
        })
      : undefined

  // The cards the reader found, God's held from the start left aside: what a reset takes away.
  const collectedCount = Object.keys(collected).length

  const turnOff = async () => {
    const confirmed = await confirm({
      title: t('collection.disableTitle'),
      message: t('collection.disableMessage'),
      confirmLabel: t('collection.disableConfirm'),
      cancelLabel: t('Annuler'),
    })
    if (!confirmed) return
    dispatch(setSettingsCardCollection(false))
    router.back()
  }

  const reset = async () => {
    const confirmed = await confirm({
      title: t('collection.resetTitle'),
      message: t('collection.resetMessage', { count: collectedCount }),
      confirmLabel: t('collection.resetConfirm'),
      cancelLabel: t('Annuler'),
      destructive: true,
    })
    if (confirmed) dispatch(resetCards())
  }

  const filters: FiltersHeaderItem[] = [
    {
      key: 'show',
      icon: 'filter',
      label: t('collection.show'),
      value: t(`collection.filters.${filter}`),
      active: filter !== 'all',
      onPress: () => {},
      options: FILTERS.map(item => ({
        key: item,
        label: t(`collection.filters.${item}`),
        selected: item === filter,
        onSelect: () => setFilter(item),
      })),
    },
    {
      key: 'order',
      icon: 'clock',
      label: t('collection.order'),
      value: t(`collection.sort.${order}`),
      active: order !== 'bible',
      onPress: () => {},
      options: ORDERS.map(item => ({
        key: item,
        label: t(`collection.sort.${item}`),
        selected: item === order,
        onSelect: () => setOrder(item),
      })),
    },
  ]

  const header = (
    <FiltersHeader
      hasBackButton
      title={t('collection.title')}
      filters={filters}
      onReset={() => {
        setFilter('all')
        setOrder('bible')
      }}
      actions={
        <MenuView
          accessibilityLabel={t('collection.menu')}
          actions={[
            { id: 'disable', title: t('collection.disable'), image: 'xmark.circle' },
            {
              id: 'reset',
              title: t('collection.reset'),
              image: 'trash',
              attributes: { destructive: true, disabled: collectedCount === 0 },
            },
          ]}
          onPressAction={({ nativeEvent }) => {
            switch (nativeEvent.event) {
              case 'disable':
                void turnOff()
                break
              case 'reset':
                void reset()
                break
            }
          }}
        >
          {/* Close to the filter button, whose own margin it takes back; the same edge as before. */}
          <Box className="flex-row items-center justify-center h-[54px] w-[36px] -ml-[10px] mr-[9px]">
            <FeatherIcon name="more-vertical" size={18} />
          </Box>
        </MenuView>
      }
    />
  )

  if (!album) {
    return (
      <Container>
        {header}
        <Loading message={t('Chargement...')} />
      </Container>
    )
  }

  // The last cards found, newest first, for the fan at the head of the album.
  const latest =
    catalog && portraits
      ? getFanCards(catalog, collected).flatMap(card => {
          const view = views.get(card.id)
          return view ? [view] : []
        })
      : []
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
            <CardAlbumSummary album={album} latest={latest} />
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
              {section.key === FOUND_GROUP || section.key === MISSING_GROUP
                ? section.data.flat().length
                : `${section.found} / ${section.total}`}
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
            if (!entity) return
            // The page opens on the card's life stage, as the album showed it.
            router.push({
              pathname: buildPublicStrongEntityPath(entity),
              params: { card: opened.id },
            } as never)
          }}
          onClose={() => setOpened(undefined)}
        />
      )}
    </Container>
  )
}

export default CardCollectionScreen

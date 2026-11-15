import { Image } from 'expo-image'
import { useIsFocused } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { useDispatch, useSelector } from 'react-redux'

import books from '~assets/bible_versions/books-desc'
import { backgroundImage } from '~common/ui/backgroundImage'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import IconTile from '~common/ui/IconTile'
import Text from '~common/ui/Text'
import { getEntityCardView, type EntityCardView } from '~features/entity-cards/cardCatalog'
import { CardIcon, CARD_ICON_HEIGHT, CARD_ICON_WIDTH } from '~features/entity-cards/CardIcon'
import { CardSpotlight, type WindowRect } from '~features/entity-cards/CardSpotlight'
import { isCardCollected } from '~features/entity-cards/chapterCards'
import { useCardCollectionEnabled } from '~features/entity-cards/useCardCollectionEnabled'
import type { StrongLexiconEntity } from '~features/resources/strongLexiconAccess'
import { collectCard } from '~redux/modules/cards'
import type { RootState } from '~redux/modules/reducer'
import { formatStrongDisplayCode } from '~helpers/strongIdentities'
import {
  formatEntityChapterRanges,
  getEntityAvatarRadius,
  getEntityPortraitText,
  getEntitySeriesPlace,
  type EntityPortraitCatalog,
  type EntityPortraitEntry,
} from './entityPortraits'
import {
  EntityPortraitTiltSensor,
  ParallaxLayer,
  useEntityPortraitLayerStyles,
  useEntityPortraitTilt,
} from './EntityPortraitParallax'
import { useCardCatalog, useEntityCardCatalog } from './entityCardManifest'
import { getEntityCardBackdropUri, getEntityCardId } from './entityCards'
import { getEntityLabel } from './StrongDetailUI'
import { useEntityPortraitGround } from './useEntityPortraitGround'
import { useEntityPortraitImage } from './useEntityPortraitImage'

const STAGE_TILE_SIZE = 92
const TITLE_FONT = 'Literata Book'

const StageTile = ({
  uniqueName,
  hash,
  label,
  chapters,
  selected,
  onPress,
}: {
  uniqueName: string
  hash: string
  label: string
  chapters?: string
  selected: boolean
  onPress: () => void
}) => {
  const image = useEntityPortraitImage(uniqueName, hash, 'w256')
  const ground = useEntityPortraitGround()
  const radius = getEntityAvatarRadius(STAGE_TILE_SIZE)
  return (
    <TouchableBox
      className="overflow-hidden border-continuous"
      style={{ width: STAGE_TILE_SIZE }}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={chapters ? `${label}, ${chapters}` : label}
    >
      {/* The ring of the chosen stage surrounds the picture, which keeps its own corners. */}
      <Box
        className={`overflow-hidden border-continuous items-center justify-center ${selected ? 'border-primary' : 'border-transparent'}`}
        style={{
          width: STAGE_TILE_SIZE,
          height: STAGE_TILE_SIZE,
          borderRadius: radius,
          borderWidth: 3,
        }}
      >
        <Box
          className="overflow-hidden border-continuous"
          style={{
            width: STAGE_TILE_SIZE - 10,
            height: STAGE_TILE_SIZE - 10,
            borderRadius: radius - 5,
            ...backgroundImage(ground),
          }}
        >
          {!!image.uri && (
            <Image
              source={{ uri: image.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={image.uri}
              onError={image.onError}
            />
          )}
        </Box>
      </Box>
      <Text className="text-[12px] font-semibold text-default mt-[7px]" numberOfLines={2}>
        {label}
      </Text>
      {!!chapters && (
        <Text className="text-[11px] text-grey mt-[2px]" numberOfLines={2}>
          {chapters}
        </Text>
      )}
    </TouchableBox>
  )
}

/**
 * The head of a painted entity's profile: its portrait in a large card with its name and title,
 * its roles and Strong numbers, its series and its stages (ADR-0089). Choosing a stage shows its
 * picture and title in the card.
 */
const StrongEntityPortraitHeader = ({
  entity,
  entry,
  catalog,
  language,
  newCard,
  card,
  onOpenStrong,
}: {
  entity: StrongLexiconEntity
  entry: EntityPortraitEntry
  catalog: EntityPortraitCatalog
  language: string
  /** A card the chapter offered and the reader has not collected: it rises over the page. */
  newCard?: string
  /** A card opened from the album: the page shows its life stage. */
  card?: string
  onOpenStrong: (stepCode: string) => void
}) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  // Opened on a card of a life stage, new or from the album, the page shows that stage: where a
  // new card will land, or the one the reader was looking at.
  const openedCard = newCard ?? card
  const newCardStage = openedCard?.startsWith(`${entity.uniqueName}~`)
    ? openedCard.slice(entity.uniqueName.length + 1)
    : undefined
  const [stageKey, setStageKey] = useState<string | undefined>(() =>
    entry.stages?.some(item => item.key === newCardStage) ? newCardStage : undefined
  )
  const stage = entry.stages?.find(item => item.key === stageKey)
  const image = useEntityPortraitImage(entity.uniqueName, stage?.hash ?? entry.hash, 'w768')
  const ground = useEntityPortraitGround()
  // The painted backdrop of the character's card (or of the chosen stage's) stands behind the
  // cut-out; the ground the application draws shows while it loads, offline, and for an entity
  // without a card.
  const cardCatalog = useEntityCardCatalog()
  const backdropUri = getEntityCardBackdropUri(cardCatalog, entity.uniqueName, stage?.key)
  const [failedBackdropUri, setFailedBackdropUri] = useState<string>()
  const showsBackdrop = !!backdropUri && backdropUri !== failedBackdropUri
  // In depth only on a backdrop, on a phone, for a reader who allows motion, while on screen.
  const isFocused = useIsFocused()
  const reduceMotion = useReducedMotion()
  const inDepth = showsBackdrop && Platform.OS !== 'web' && !reduceMotion
  const moves = inDepth && isFocused
  const tilt = useEntityPortraitTilt()
  const layers = useEntityPortraitLayerStyles(tilt)
  const title = stage?.label ?? entry.title
  const series = getEntitySeriesPlace(catalog, entity.uniqueName)
  const roles = (entry.roles ?? []).flatMap(role =>
    catalog.roles[role] ? [getEntityPortraitText(catalog.roles[role], language)] : []
  )
  // The collected card of the portrait shown stands at the right of the frame (ADR-0090).
  const cards = useCardCatalog()
  const collected = useSelector((state: RootState) => state.cards.collected)
  const cardLanguage = language === 'fr' ? 'fr' : 'en'
  const viewOf = (cardId: string | undefined): EntityCardView | undefined => {
    const published = cardId ? cards?.cards.find(item => item.id === cardId) : undefined
    return published && cards
      ? getEntityCardView(published, cards, catalog, cardLanguage)
      : undefined
  }
  const stageCardId = stage ? getEntityCardId(entity.uniqueName, stage.key) : undefined
  const cardCollection = useCardCollectionEnabled()
  const shownCard = !cardCollection
    ? undefined
    : (viewOf(
        stageCardId && cards?.cards.some(item => item.id === stageCardId) ? stageCardId : undefined
      ) ?? viewOf(entity.uniqueName))
  const revealedCard = newCard && cardCollection ? viewOf(newCard) : undefined
  const [revealing, setRevealing] = useState(
    () => !!newCard && cardCollection && !isCardCollected(newCard, collected)
  )
  // A card being collected turns gold in the header when it lands there, not at the tap.
  const [landed, setLanded] = useState(false)
  const [viewing, setViewing] = useState(false)
  const shownCollected =
    !!shownCard &&
    isCardCollected(shownCard.id, collected) &&
    !(revealing && !landed && revealedCard?.id === shownCard.id)
  const slotRef = useRef<View>(null)
  const getLandingRect = () =>
    new Promise<WindowRect | undefined>(resolve => {
      if (!slotRef.current) return resolve(undefined)
      slotRef.current.measureInWindow((x, y, width, height) =>
        resolve(width ? { x, y, width, height } : undefined)
      )
    })

  const getBookName = (book: number) => {
    const name = books.find(item => item.Numero === book)?.Nom
    return name ? t(name, { lng: language }) : String(book)
  }

  return (
    <VStack className="overflow-hidden border-continuous gap-[14px]">
      <Box className="overflow-hidden border-continuous bg-surface rounded-[24px] p-[10px]">
        <Box
          className="overflow-hidden border-continuous rounded-[16px]"
          style={{ aspectRatio: 1, ...backgroundImage(ground) }}
        >
          {moves && <EntityPortraitTiltSensor tilt={tilt} />}
          {showsBackdrop && (
            <ParallaxLayer style={[StyleSheet.absoluteFill, inDepth && layers.backdrop]}>
              <Image
                source={{ uri: backdropUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                // The backdrop is 2:3: the square keeps the band behind the head and shoulders.
                contentPosition={{ left: '50%', top: '28%' }}
                cachePolicy="memory-disk"
                transition={250}
                recyclingKey={backdropUri}
                onError={() => setFailedBackdropUri(backdropUri)}
                accessible={false}
              />
            </ParallaxLayer>
          )}
          {!!image.uri && (
            <ParallaxLayer style={[StyleSheet.absoluteFill, inDepth && layers.subject]}>
              <Image
                source={{ uri: image.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
                recyclingKey={image.uri}
                onError={image.onError}
                accessibilityLabel={entity.name}
              />
            </ParallaxLayer>
          )}
        </Box>
        <HStack className="items-center gap-[12px] px-[8px] pt-[14px] pb-[6px]">
          <VStack className="overflow-hidden border-continuous flex-[1] gap-[3px]">
            <Text
              className="text-[12px] font-semibold text-grey"
              style={{ letterSpacing: 1.6, textTransform: 'uppercase' }}
            >
              {getEntityLabel(entity.category, entity.type, t)}
            </Text>
            <Text
              className="text-default"
              style={{ fontFamily: TITLE_FONT, fontSize: 32, lineHeight: 38 }}
            >
              {entity.name}
            </Text>
            {!!title && (
              <Text
                className="text-grey"
                style={{ fontFamily: TITLE_FONT, fontSize: 17, lineHeight: 24 }}
              >
                {getEntityPortraitText(title, language)}
              </Text>
            )}
          </VStack>
          {/* The card of the portrait shown: grey until collected, then gold; it opens large. */}
          {shownCard && (
            <Pressable
              ref={slotRef}
              collapsable={false}
              disabled={!shownCollected}
              accessibilityRole={shownCollected ? 'button' : 'image'}
              accessibilityLabel={t(shownCollected ? 'entityCards.open' : 'entityCards.notFound', {
                name: shownCard.name,
              })}
              onPress={() => setViewing(true)}
              hitSlop={12}
              style={({ pressed }) => ({
                width: CARD_ICON_WIDTH,
                height: CARD_ICON_HEIGHT,
                marginTop: 6,
                marginRight: 4,
                transform: [{ scale: pressed ? 0.9 : 1 }],
              })}
            >
              <CardIcon collected={shownCollected} />
            </Pressable>
          )}
        </HStack>
      </Box>

      {revealing && revealedCard && (
        <CardSpotlight
          card={revealedCard}
          mode="reveal"
          getLandingRect={getLandingRect}
          onCollect={() => dispatch(collectCard({ id: revealedCard.id, collectedAt: Date.now() }))}
          onLanded={() => setLanded(true)}
          onClose={() => setRevealing(false)}
        />
      )}
      {viewing && shownCard && (
        <CardSpotlight card={shownCard} mode="view" onClose={() => setViewing(false)} />
      )}

      {!!entry.stages?.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <HStack className="overflow-hidden border-continuous gap-[12px]">
            <StageTile
              uniqueName={entity.uniqueName}
              hash={entry.hash}
              label={entry.title ? getEntityPortraitText(entry.title, language) : entity.name}
              selected={!stage}
              onPress={() => setStageKey(undefined)}
            />
            {entry.stages.map(item => (
              <StageTile
                key={item.key}
                uniqueName={entity.uniqueName}
                hash={item.hash}
                label={getEntityPortraitText(item.label, language)}
                chapters={formatEntityChapterRanges(item.ranges, getBookName)}
                selected={item.key === stage?.key}
                onPress={() => setStageKey(item.key)}
              />
            ))}
          </HStack>
        </ScrollView>
      )}

      {(roles.length > 0 || entity.strongCodes.length > 0) && (
        <HStack className="overflow-hidden border-continuous gap-[6px] flex-wrap">
          {roles.map(role => (
            <Box
              key={role}
              className="overflow-hidden border-continuous bg-surface rounded-full px-[11px] py-[5px]"
            >
              <Text className="text-[13px] text-default">{role}</Text>
            </Box>
          ))}
          {entity.strongCodes.map(code => (
            <TouchableBox
              key={code}
              className="overflow-hidden border-continuous bg-light-primary rounded-full px-[11px] py-[5px]"
              onPress={() => onOpenStrong(code)}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel={formatStrongDisplayCode(code)}
            >
              <Text className="text-[13px] font-semibold text-link">
                {formatStrongDisplayCode(code)}
              </Text>
            </TouchableBox>
          ))}
        </HStack>
      )}

      {!!series && (
        <Card>
          <HStack className="overflow-hidden border-continuous items-center gap-[12px] px-[14px] py-[12px]">
            <IconTile tint="primary">
              <FeatherIcon name="layers" size={16} color="primary" />
            </IconTile>
            <VStack className="overflow-hidden border-continuous flex-[1]">
              <Text className="text-[15px] font-semibold text-default">
                {getEntityPortraitText(series.title, language)}
              </Text>
              <Text className="text-[13px] text-grey">
                {t('strongDetail.entity.seriesRank', {
                  rank: series.rank,
                  total: series.total,
                  lng: language,
                })}
              </Text>
            </VStack>
          </HStack>
        </Card>
      )}
    </VStack>
  )
}

export default StrongEntityPortraitHeader

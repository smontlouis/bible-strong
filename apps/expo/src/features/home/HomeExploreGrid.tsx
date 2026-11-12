import { Image, type ImageSource } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Link, { type LinkProps } from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import useLanguage from '~helpers/useLanguage'
import type { MainStackProps } from '~navigation/type'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { HomeGrid, useHomeLayout } from './homeLayout'

/** Tinted area of a card; the illustration is taller, so the head rises above the card. */
const TINT_HEIGHT = 86
const ART_HEIGHT = 120
const OVERFLOW = ART_HEIGHT - TINT_HEIGHT
/** Height of the card of a wider home, which is its tint from edge to edge. */
const WIDE_CARD_HEIGHT = 96
/** Ink on a tint: the tints stay light in every theme, so their text stays dark. */
const TINT_INK = '#101b35'
type ExploreCard = {
  id: string
  title: string
  /** Read aloud with the title; the card itself shows the title alone. */
  hint: string
  image: ImageSource
  /**
   * Transparent illustration drawn on a tint, which belongs to the illustration and so keeps its
   * own light colour in every theme. The bust always sits on the bottom edge of the tint;
   * `drop` lowers the art by that many points when an object in front of the bust (a scroll)
   * should spill onto the text area.
   */
  art: { tint: string; align: 'left' | 'center'; drop?: number }
  link: Pick<LinkProps<keyof MainStackProps>, 'route' | 'params' | 'onPress'>
}

/**
 * Editorial entries of the home, all in the same card: image and title. On a phone the title sits
 * under the tint, on the card's surface. A wider home gives the whole card to the tint, the
 * illustration on its left and the title in its bottom right corner. Either way the head of the
 * illustration rises above the card.
 */
const HomeExploreGrid = () => {
  const { t } = useTranslation()
  const { wide } = useHomeLayout()
  const lang = useLanguage()
  const pushRoute = usePushRouteOnce()
  const plans = useComputedPlanItems()
  const bibleProjectPlan = plans.find(
    plan => plan.id === (lang === 'fr' ? 'bible-project-plan' : 'bible-project-plan-en')
  )

  const cards: ExploreCard[] = [
    {
      id: 'videos',
      title: t('passageMediaLibrary.title'),
      hint: t('passageMediaLibrary.heading'),
      image: require('~assets/images/home/explore/courses-videos.webp'),
      art: { tint: '#E6EDFF', align: 'left', drop: 12 },
      link: { onPress: () => pushRoute({ pathname: '/(library)/passage-media' }) },
    },
    {
      id: 'timeline',
      title: t('La Chronologie biblique'),
      hint: t('newTab.timelineDescription'),
      image: require('~assets/images/home/explore/timeline.webp'),
      art: { tint: '#E3EFE6', align: 'left', drop: 14 },
      link: { route: 'TimelineHome' },
    },
    ...(bibleProjectPlan
      ? [
          {
            id: 'bible-project',
            title: t('home.learning.bibleProjectPlan'),
            hint: t('readingPlans.readAtYourPace'),
            image: require('~assets/images/home/explore/bible-project.webp'),
            art: { tint: '#FFE6DE', align: 'left', drop: 12 },
            link: {
              route: 'Plan',
              params: { planId: bibleProjectPlan.id, plan: bibleProjectPlan },
            },
          } satisfies ExploreCard,
        ]
      : []),
    {
      id: 'meditations',
      title: t('home.meditations.collections'),
      hint: t('dailyReading.howItWorks'),
      image: require('~assets/images/home/explore/meditations.webp'),
      art: { tint: '#FFF3D1', align: 'left', drop: 8 },
      link: { onPress: () => pushRoute({ pathname: '/daily-reading' }) },
    },
  ]

  return (
    // The illustrations rise above their tinted area, so rows leave room for the overflow.
    <HomeGrid columns={2} rowGap={12 + OVERFLOW} style={{ paddingTop: OVERFLOW }}>
      {cards.map(card =>
        wide ? (
          <Link
            key={card.id}
            {...card.link}
            accessibilityLabel={card.title}
            accessibilityHint={card.hint}
            className="rounded-[16px] justify-end items-end pr-[16px] pb-[14px]"
            style={{ height: WIDE_CARD_HEIGHT, backgroundColor: card.art.tint, paddingLeft: 132 }}
          >
            {/* Taller than the card: it cuts the bust on the bottom corners and lets the head rise. */}
            <Box
              className="absolute left-0 right-0 bottom-0 rounded-b-[16px] overflow-hidden"
              style={{ top: -OVERFLOW }}
              pointerEvents="none"
            >
              <Image
                source={card.image}
                contentFit="contain"
                contentPosition="bottom left"
                accessible={false}
                style={{
                  position: 'absolute',
                  left: 8,
                  right: 0,
                  bottom: -(card.art.drop ?? 0),
                  height: WIDE_CARD_HEIGHT + OVERFLOW + (card.art.drop ?? 0),
                }}
              />
            </Box>
            <Text
              className="text-[15px] leading-[19px] font-bold text-right"
              style={{ color: TINT_INK }}
              numberOfLines={2}
            >
              {card.title}
            </Text>
          </Link>
        ) : (
          <Link
            key={card.id}
            {...card.link}
            accessibilityLabel={card.title}
            accessibilityHint={card.hint}
            className="rounded-[16px] bg-surface"
          >
            <Box
              className="rounded-t-[16px] z-10"
              style={{ height: TINT_HEIGHT, backgroundColor: card.art.tint, overflow: 'visible' }}
            >
              <Image
                source={card.image}
                contentFit="contain"
                contentPosition={card.art.align === 'left' ? 'bottom left' : 'bottom'}
                accessible={false}
                style={{
                  position: 'absolute',
                  left: card.art.align === 'left' ? 6 : 0,
                  right: 0,
                  bottom: -(card.art.drop ?? 0),
                  height: ART_HEIGHT + (card.art.drop ?? 0),
                }}
              />
            </Box>
            {/* Room for two lines of title, so the cards of a row keep one height. */}
            <Box className="px-[12px] pt-[16px] pb-[12px] min-h-[66px]">
              <Text className="text-[15px] leading-[19px] font-bold" numberOfLines={2}>
                {card.title}
              </Text>
            </Box>
          </Link>
        )
      )}
    </HomeGrid>
  )
}

export default HomeExploreGrid

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
/** Content width from which the four cards share a single row. */
const SINGLE_ROW_CONTENT = 720

type ExploreCard = {
  id: string
  title: string
  description: string
  image: ImageSource
  /**
   * Transparent illustration drawn on a tint, which belongs to the illustration and so keeps its
   * own light colour in every theme. The bust always sits on the bottom edge of the tint;
   * `drop` lowers the art by that many points when an object in front of the bust (a scroll)
   * should spill onto the text area.
   */
  art?: { tint: string; align: 'left' | 'center'; drop?: number }
  link: Pick<LinkProps<keyof MainStackProps>, 'route' | 'params' | 'onPress'>
}

/**
 * Editorial entries of the home, all in the same card on the canvas: image, title, one-line hint.
 * The card keeps its overflow visible so the illustration can rise above it.
 */
const HomeExploreGrid = () => {
  const { t } = useTranslation()
  const { content } = useHomeLayout()
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
      description: t('passageMediaLibrary.heading'),
      image: require('~assets/images/home/explore/courses-videos.webp'),
      art: { tint: '#E6EDFF', align: 'left', drop: 12 },
      link: { onPress: () => pushRoute({ pathname: '/(library)/passage-media' }) },
    },
    {
      id: 'timeline',
      title: t('La Chronologie biblique'),
      description: t('newTab.timelineDescription'),
      image: require('~assets/images/home/explore/timeline.webp'),
      art: { tint: '#E3EFE6', align: 'center', drop: 14 },
      link: { route: 'TimelineHome' },
    },
    ...(bibleProjectPlan
      ? [
          {
            id: 'bible-project',
            title: t('home.learning.bibleProjectPlan'),
            description: t('readingPlans.readAtYourPace'),
            image: require('~assets/images/home/bible-project-plan.jpg'),
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
      description: t('dailyReading.howItWorks'),
      image: require('~assets/images/home/explore/meditations.webp'),
      art: { tint: '#FFF3D1', align: 'center', drop: 8 },
      link: { onPress: () => pushRoute({ pathname: '/daily-reading' }) },
    },
  ]

  return (
    // The illustrations rise above their tinted area, so rows leave room for the overflow.
    <HomeGrid
      columns={content >= SINGLE_ROW_CONTENT ? 4 : 2}
      rowGap={12 + OVERFLOW}
      style={{ paddingTop: OVERFLOW }}
    >
      {cards.map(card => (
        <Link
          key={card.id}
          {...card.link}
          accessibilityLabel={card.title}
          accessibilityHint={card.description}
          className="rounded-[16px] bg-surface"
        >
          {card.art ? (
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
          ) : (
            <Box
              className="rounded-t-[16px] overflow-hidden bg-canvas"
              style={{ height: TINT_HEIGHT }}
            >
              <Image
                source={card.image}
                contentFit="cover"
                accessible={false}
                style={{ width: '100%', height: '100%' }}
              />
            </Box>
          )}
          <Box className="px-[12px] pt-[16px] pb-[12px] gap-[2px] min-h-[82px]">
            <Text className="text-[15px] leading-[19px] font-bold" numberOfLines={2}>
              {card.title}
            </Text>
            <Text className="text-[12px] leading-[16px] text-grey" numberOfLines={2}>
              {card.description}
            </Text>
          </Box>
        </Link>
      ))}
    </HomeGrid>
  )
}

export default HomeExploreGrid

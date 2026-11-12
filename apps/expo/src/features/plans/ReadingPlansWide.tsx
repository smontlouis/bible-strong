import { Image } from 'expo-image'
import { useState, type ReactNode } from 'react'
import { ScrollView, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import type { OnlinePlan } from '~common/types'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import ListSection from '~common/ui/ListSection'
import Text from '~common/ui/Text'
import PlanContinuePill from './PlanContinuePill'
import PlanStreak from './PlanStreak'
import { ReadingPlanRow } from './ReadingPlansScreen'
import { useReadingPlanRow } from './useReadingPlanRow'

const PAGE_MAX_WIDTH = 1140
const SIDE_WIDTH = 400
const COLUMN_GAP = 36
const PAGE_PADDING = 20
const CARD_GAP = 14
/** A cover card is never narrower than this: the column count follows from it. */
const CARD_MIN_WIDTH = 200

/** The plan's image at 16:9, or the tinted mark of a plan that has none. */
const Cover = ({ image, className }: { image?: string; className?: string }) => (
  <Box
    className={`rounded-[8px] bg-canvas overflow-hidden ${className ?? ''}`}
    style={{ aspectRatio: 16 / 9 }}
  >
    {image ? (
      <Image
        source={{ uri: image }}
        contentFit="cover"
        accessible={false}
        style={{ width: '100%', height: '100%' }}
      />
    ) : (
      <Box className="flex-1 items-center justify-center">
        <FeatherIcon name="book-open" size={24} color="primary" />
      </Box>
    )}
  </Box>
)

/** A followed plan: its cover beside where the reader stands, the bar, the streak and the button. */
const FollowedPlanTile = ({ plan }: { plan: OnlinePlan }) => {
  const { image, journey, progress, hasReadings, detail, pill, open, onPill } = useReadingPlanRow(
    plan,
    'active'
  )
  return (
    <Card className="flex-row items-center gap-[14px] p-[12px]">
      <Link
        onPress={open}
        accessibilityLabel={`${plan.title}, ${detail}`}
        className="flex-1 min-w-0 flex-row items-center gap-[14px]"
      >
        <Cover image={image} className="w-[112px]" />
        <Box className="flex-1 min-w-0 gap-[7px]">
          <Text className="text-default font-bold text-[15px] leading-[19px]" numberOfLines={2}>
            {plan.title}
          </Text>
          {hasReadings && (
            <Box className="h-[6px] bg-canvas rounded-full overflow-hidden">
              <Box
                className="h-full bg-primary rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
            </Box>
          )}
          <Box className="flex-row flex-wrap items-center gap-[8px]">
            <Text className="text-grey text-[13px]" style={{ fontVariant: ['tabular-nums'] }}>
              {detail}
            </Text>
            <PlanStreak count={journey.streak} />
          </Box>
        </Box>
      </Link>
      {pill && <PlanContinuePill label={pill} hint={plan.title} onPress={onPill} />}
    </Card>
  )
}

/** A plan of the catalogue: its cover above its title and its length. */
const CatalogueCard = ({ plan, width }: { plan: OnlinePlan; width: number }) => {
  const { image, detail, open } = useReadingPlanRow(plan, 'discover')
  return (
    <Link onPress={open} accessibilityLabel={`${plan.title}, ${detail}`} style={{ width }}>
      <Card className="flex-1 gap-[10px] p-[10px] pb-[14px]">
        <Cover image={image} />
        <Box className="gap-[3px] px-[4px]">
          <Text className="text-default font-bold text-[15px] leading-[19px]" numberOfLines={2}>
            {plan.title}
          </Text>
          <Text className="text-grey text-[13px]">{detail}</Text>
        </Box>
      </Card>
    </Link>
  )
}

/** The catalogue's shelves: how long a plan takes is the first question before starting one. */
const SHELVES = [
  { key: 'readingPlans.shelf.short', holds: (days: number) => days > 0 && days <= 10 },
  { key: 'readingPlans.shelf.month', holds: (days: number) => days > 10 && days <= 31 },
  { key: 'readingPlans.shelf.long', holds: (days: number) => days > 31 || days <= 0 },
]

const Stat = ({ value, label }: { value: number; label: string }) => (
  <Box className="flex-1 px-[14px] py-[12px] gap-[4px]">
    <Text className="text-default font-bold text-[18px]" style={{ fontVariant: ['tabular-nums'] }}>
      {value}
    </Text>
    <Text className="text-grey text-[12px]">{label}</Text>
  </Box>
)

/**
 * The plans on a large Web window, laid out like the home: the reader's plans stay in place on
 * the left, the catalogue scrolls on the right as cover cards on shelves by length. With no
 * followed plan the catalogue takes the whole page.
 */
const ReadingPlansWide = ({
  active,
  completed,
  discoverable,
  notices,
  missed,
  height,
}: {
  active: OnlinePlan[]
  completed: OnlinePlan[]
  discoverable: OnlinePlan[]
  notices: ReactNode
  /** Readings left behind across the followed plans. */
  missed: number
  /** Height of the page. */
  height: number
}) => {
  const { t } = useTranslation()
  const [catalogueWidth, setCatalogueWidth] = useState(0)
  const [sideHeight, setSideHeight] = useState(0)
  const hasSide = active.length + completed.length > 0
  // A side column taller than the window scrolls with the page, or its end could not be reached.
  const sideStays = sideHeight > 0 && sideHeight + PAGE_PADDING <= height
  const columns = Math.max(1, Math.floor((catalogueWidth + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP)))
  const cardWidth = Math.floor((catalogueWidth - CARD_GAP * (columns - 1)) / columns)

  return (
    <ScrollView
      contentContainerStyle={{
        width: '100%',
        maxWidth: PAGE_MAX_WIDTH,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: COLUMN_GAP,
        paddingHorizontal: PAGE_PADDING,
        paddingBottom: 48,
      }}
    >
      {hasSide && (
        <Box
          onLayout={({ nativeEvent }) => setSideHeight(Math.round(nativeEvent.layout.height))}
          className="gap-[14px]"
          style={[
            { width: SIDE_WIDTH, paddingTop: PAGE_PADDING },
            sideStays && ({ position: 'sticky', top: 0 } as unknown as ViewStyle),
          ]}
        >
          <Text className="text-default font-bold text-[18px]">{t('readingPlans.yours')}</Text>
          <Card className="flex-row">
            <Stat value={active.length} label={t('readingPlans.stats.active')} />
            <Stat value={completed.length} label={t('readingPlans.stats.completed')} />
            <Stat value={missed} label={t('readingPlans.stats.missed')} />
          </Card>
          {active.map(plan => (
            <FollowedPlanTile key={plan.id} plan={plan} />
          ))}
          {!!completed.length && (
            <ListSection title={t('readingPlans.completedPlans')} className="mx-0 mb-0">
              {completed.map(plan => (
                <ReadingPlanRow key={plan.id} plan={plan} kind="completed" />
              ))}
            </ListSection>
          )}
        </Box>
      )}
      <Box
        className="flex-1 min-w-0 gap-[22px]"
        style={{ paddingTop: PAGE_PADDING }}
        onLayout={({ nativeEvent }) => setCatalogueWidth(Math.round(nativeEvent.layout.width))}
      >
        <Text className="text-default font-bold text-[18px]">{t('readingPlans.explore')}</Text>
        {notices}
        {catalogueWidth > 0 &&
          SHELVES.map(shelf => {
            const plans = discoverable.filter(plan => shelf.holds(plan.duration ?? 0))
            if (!plans.length) return null
            return (
              <Box key={shelf.key} className="gap-[8px]">
                <Text className="text-grey text-[13px] px-[2px]">{t(shelf.key)}</Text>
                <Box className="flex-row flex-wrap" style={{ gap: CARD_GAP }}>
                  {plans.map(plan => (
                    <CatalogueCard key={plan.id} plan={plan} width={cardWidth} />
                  ))}
                </Box>
              </Box>
            )
          })}
      </Box>
    </ScrollView>
  )
}

export default ReadingPlansWide

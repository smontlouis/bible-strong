import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import HistoryHomeSection, { useHomeHistory } from '~features/history/HistoryHomeSection'
import HomeSectionTitle from './HomeSectionTitle'
import HomeSubsectionTitle from './HomeSubsectionTitle'
import PlanHome, { PlansExploreLink, useFollowedPlans } from './PlanHome'
import { useHomeLayout } from './homeLayout'

/** Content width from which the history and the plans sit side by side. */
const SPLIT_CONTENT = 760

/** « Tout voir », the History link. */
const SeeAllHistory = () => {
  const { t } = useTranslation()
  return (
    <Link
      route="History"
      accessibilityLabel={`${t('history.seeAll')} · ${t('history.title')}`}
      className="py-[12px]"
    >
      <Text className="text-link text-[13px] font-bold">{t('history.seeAll')}</Text>
    </Link>
  )
}

/**
 * « Reprendre », the reader's work in progress, right after the day: the latest History entries,
 * then the followed plans under « Mes plans ». A wide home sets the two side by side, each under
 * its own part title. While the history is empty the group is « Mes plans » alone.
 */
const HomeResumeSection = () => {
  const { t } = useTranslation()
  const { content } = useHomeLayout()
  const hasHistory = useHomeHistory().length > 0
  // The invitation card already opens the catalogue, so « À découvrir » only joins real plans.
  const explore = useFollowedPlans().length > 0 ? <PlansExploreLink /> : undefined

  if (!hasHistory)
    return (
      <>
        <HomeSectionTitle title={t('home.myPlans')} action={explore} />
        <Box className="px-[20px]">
          <PlanHome />
        </Box>
      </>
    )

  if (content >= SPLIT_CONTENT)
    return (
      <>
        <HomeSectionTitle title={t('home.resume')} />
        <Box className="flex-row gap-[20px] px-[20px]">
          <Box className="flex-1 min-w-0">
            <HomeSubsectionTitle
              title={t('history.title')}
              className="px-0 pt-0"
              action={<SeeAllHistory />}
            />
            <HistoryHomeSection headerless columns={2} />
          </Box>
          <Box className="flex-1 min-w-0">
            <HomeSubsectionTitle title={t('home.myPlans')} className="px-0 pt-0" action={explore} />
            <PlanHome />
          </Box>
        </Box>
      </>
    )

  return (
    <>
      <HomeSectionTitle title={t('home.resume')} action={<SeeAllHistory />} />
      <HistoryHomeSection headerless />
      <HomeSubsectionTitle title={t('home.myPlans')} action={explore} />
      <Box className="px-[20px]">
        <PlanHome />
      </Box>
    </>
  )
}

export default HomeResumeSection

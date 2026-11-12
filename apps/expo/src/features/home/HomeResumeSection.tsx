import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import HistoryHomeSection, { useHomeHistory } from '~features/history/HistoryHomeSection'
import HomeSectionTitle from './HomeSectionTitle'
import HomeSubsectionTitle from './HomeSubsectionTitle'
import { useHomeLayout } from './homeLayout'
import PlanHome, { PlansExploreLink, useFollowedPlans } from './PlanHome'

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
 * then the followed plans under « Mes plans », one below the other at every width. While the history is empty the group is « Mes plans » alone.
 */
const HomeResumeSection = () => {
  const { t } = useTranslation()
  // A mouse cannot swipe the row of a phone, so a wider column lays the entries two by two.
  const { wide } = useHomeLayout()
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

  return (
    <>
      <HomeSectionTitle title={t('home.resume')} action={<SeeAllHistory />} />
      {wide ? (
        <Box className="px-[20px]">
          <HistoryHomeSection headerless columns={2} />
        </Box>
      ) : (
        <HistoryHomeSection headerless />
      )}
      <HomeSubsectionTitle title={t('home.myPlans')} action={explore} />
      <Box className="px-[20px]">
        <PlanHome />
      </Box>
    </>
  )
}

export default HomeResumeSection

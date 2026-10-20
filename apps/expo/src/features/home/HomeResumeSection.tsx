import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import HistoryHomeSection, { useHomeHistory } from '~features/history/HistoryHomeSection'
import HomeSubsectionTitle from './HomeSubsectionTitle'
import PlanHome, { PlansExploreLink, useFollowedPlans } from './PlanHome'
import { useHomeLayout } from './homeLayout'

/** Content width from which the history and the plans sit side by side. */
const SPLIT_CONTENT = 760

/**
 * « Reprendre » and « Mes plans », the reader's work in progress, as parts of « Ma
 * bibliothèque ». A wide home sets them side by side; « Reprendre » disappears while the
 * history is empty, and the plans then take the whole width.
 */
const HomeResumeSection = () => {
  const { t } = useTranslation()
  const { content } = useHomeLayout()
  const hasHistory = useHomeHistory().length > 0
  const hasPlans = useFollowedPlans().length > 0
  const split = content >= SPLIT_CONTENT
  const titleClassName = split ? 'px-0' : undefined

  const resume = hasHistory && (
    <Box className={split ? 'flex-1 min-w-0' : undefined}>
      <HomeSubsectionTitle
        title={t('home.resume')}
        className={titleClassName}
        action={
          <Link route="History" className="py-[12px]">
            <Text className="text-primary text-[13px] font-bold">{t('history.title')}</Text>
          </Link>
        }
      />
      <HistoryHomeSection headerless columns={split ? 2 : undefined} />
    </Box>
  )
  // The invitation card already opens the catalogue, so « À découvrir » only joins real plans.
  const plans = (
    <Box className={split ? 'flex-1 min-w-0' : undefined}>
      <HomeSubsectionTitle
        title={t('home.myPlans')}
        className={titleClassName}
        action={hasPlans ? <PlansExploreLink /> : undefined}
      />
      <Box className={split ? undefined : 'px-[20px]'}>
        <PlanHome />
      </Box>
    </Box>
  )

  if (split)
    return (
      <Box className="flex-row gap-[20px] px-[20px]">
        {resume}
        {plans}
      </Box>
    )

  return (
    <>
      {resume}
      {plans}
    </>
  )
}

export default HomeResumeSection

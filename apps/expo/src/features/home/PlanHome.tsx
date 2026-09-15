import { Asset } from 'expo-asset'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Link from '~common/Link'
import type { Plan } from '~common/types'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useComputedPlanItems, useUpdatePlans } from '~features/plans/plan.hooks'
import { getEditorialKind } from '~features/plans/readingCalendar'
import { hasPlanParticipation } from '~features/plans/planProgress'
import FollowedPlanCard from '~features/plans/FollowedPlanCard'
import useLanguage from '~helpers/useLanguage'
import { addPlan } from '~redux/modules/plan'
import type { RootState } from '~redux/modules/reducer'

const readResponseText = async (response: Response): Promise<string> => {
  if (!response.ok) {
    throw new Error(`Failed to load bundled plan: HTTP ${response.status}`)
  }
  return response.text()
}

const loadBibleProjectPlan = async (lang: string): Promise<Plan | undefined> => {
  const [asset] = await Asset.loadAsync(
    lang === 'fr'
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('~assets/plans/bible-project-plan.txt')
      : // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('~assets/plans/bible-project-plan-en.txt')
  )

  let serialized: string | undefined
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri)
    serialized = await readResponseText(response)
  } else if (asset.localUri) {
    const FileSystem = await import('expo-file-system/legacy')
    serialized = await FileSystem.readAsStringAsync(asset.localUri)
  }

  return serialized ? (JSON.parse(serialized) as Plan) : undefined
}

const useGetFirstPlans = () => {
  const lang = useLanguage()
  const planId = lang === 'fr' ? 'bible-project-plan' : 'bible-project-plan-en'
  const hasPlan = useSelector((state: RootState) =>
    state.plan.myPlans.some(plan => plan.id === planId)
  )
  const dispatch = useDispatch()
  useEffect(() => {
    if (hasPlan) return
    let active = true
    void loadBibleProjectPlan(lang)
      .then(plan => {
        if (active && plan) dispatch(addPlan(plan))
      })
      .catch(error => console.warn('[Home] Could not load bundled reading plan', error))
    return () => {
      active = false
    }
  }, [hasPlan, lang, dispatch])
}

const PlanHome = ({ compact = false }: { compact?: boolean }) => {
  const { t } = useTranslation()
  const plans = useComputedPlanItems()
  const participations = useSelector((state: RootState) => state.plan.ongoingPlans)
  const followed = plans.flatMap(plan => {
    const participation = participations.find(item => item.id === plan.id)
    return getEditorialKind(plan) === 'reading-plan' &&
      participation &&
      hasPlanParticipation(participation)
      ? [{ plan, participation }]
      : []
  })
  useUpdatePlans()
  useGetFirstPlans()

  if (!followed.length) {
    return (
      <Box className={compact ? '' : 'bg-light-grey px-[20px] pt-[20px]'}>
        <Link route="Plans" accessibilityLabel={t('readingPlans.explorePlans')}>
          <Box className="bg-reverse rounded-[20px] p-[18px] flex-row items-center gap-[14px]">
            <Box className="w-[48px] h-[48px] rounded-[14px] bg-light-grey items-center justify-center">
              <FeatherIcon name="book-open" size={24} color="primary" />
            </Box>
            <Box className="flex-1 gap-[5px]">
              <Text className="text-default font-bold text-[16px]">
                {t('readingPlans.explorePlans')}
              </Text>
              <Text className="text-grey text-[13px]">{t('readingPlans.readAtYourPace')}</Text>
            </Box>
            <FeatherIcon name="chevron-right" size={20} color="primary" />
          </Box>
        </Link>
      </Box>
    )
  }

  return (
    <Box className={compact ? 'gap-[16px]' : 'bg-light-grey px-[20px] pt-[20px] gap-[12px]'}>
      <Box className="flex-row items-center justify-between gap-[12px]">
        <Text className="text-default font-bold text-[16px]">{t('readingPlans.yours')}</Text>
        <Link
          route="Plans"
          className="flex-row items-center gap-[6px] py-[12px]"
          accessibilityLabel={t('readingPlans.explorePlans')}
        >
          <Text className="text-primary text-[13px] font-bold">{t('readingPlans.explore')}</Text>
          <FeatherIcon name="chevron-right" size={16} color="primary" />
        </Link>
      </Box>
      {followed.map(({ plan, participation }) => (
        <FollowedPlanCard key={plan.id} plan={plan} participation={participation} />
      ))}
    </Box>
  )
}

export default PlanHome

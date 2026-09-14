import { useDispatch, useSelector } from 'react-redux'
import { fetchPlans } from '~redux/modules/plan'
import type { AppDispatch } from '~redux/store'
import type { RootState } from '~redux/modules/reducer'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getEditorialKind } from '~features/plans/readingCalendar'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import { getEvents } from '~features/timeline/events'
import { matchesQuery } from '../shared/matchesQuery'
import {
  searchCommentaries,
  searchTimeline,
  type CatalogScope,
  type CatalogResult,
} from './catalogSearch'

export function useCatalogSearch(
  query: string,
  scope?: CatalogScope,
  enabled = true,
  selectedScopes?: readonly CatalogScope[]
) {
  const includes = (type: CatalogScope) =>
    enabled && (!scope || scope === type) && (!selectedScopes || selectedScopes.includes(type))
  const { t, i18n } = useTranslation()
  const savedPlans = useComputedPlanItems()
  const cachedPlans = useSelector((state: RootState) => state.plan.onlinePlans)
  const dispatch = useDispatch<AppDispatch>()
  const catalog = useQuery({
    queryKey: ['search-plan-catalog'],
    queryFn: () => dispatch(fetchPlans()).unwrap(),
    enabled: includes('plan'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const plans = [
    ...savedPlans,
    ...(catalog.data ?? cachedPlans).filter(
      plan => !savedPlans.some(saved => saved.id === plan.id)
    ),
  ]
  const timeline = useQuery({
    queryKey: ['timeline'],
    queryFn: getEvents,
    enabled: includes('timeline'),
    staleTime: Infinity,
  })
  const items: CatalogResult[] = enabled
    ? [
        ...(includes('commentary') ? searchCommentaries(query, i18n.language) : []),
        ...(includes('plan')
          ? plans
              .filter(plan => matchesQuery(query, plan.title))
              .map(plan => ({
                id: `plan:${plan.id}`,
                title: plan.title,
                subtitle: t(
                  getEditorialKind(plan) === 'daily-meditation'
                    ? 'dailyReading.collection'
                    : 'readingPlans.tab'
                ),
                type: 'plan' as const,
                tab: {
                  type: 'plan' as const,
                  title: plan.title,
                  isRemovable: true,
                  data: { planId: plan.id },
                },
              }))
          : []),
        ...(includes('timeline') ? searchTimeline(timeline.data ?? [], query, i18n.language) : []),
      ]
    : []
  return {
    items,
    loading:
      (timeline.isFetching && includes('timeline')) || (catalog.isFetching && includes('plan')),
    error: (timeline.isError && includes('timeline')) || (catalog.isError && includes('plan')),
    retry: () => {
      if (includes('timeline')) void timeline.refetch()
      if (includes('plan')) void catalog.refetch()
    },
  }
}

import type { OnlinePlan } from '~common/types'
import { matchesQuery } from '~features/search/shared/matchesQuery'

export type ReadingPlanFilters = { query: string; language: OnlinePlan['lang'] | 'all' }
export type ReadingPlanFilterParams = { language?: string | string[]; search?: string | string[] }

export function defaultReadingPlanFilters(language: string): ReadingPlanFilters {
  return { query: '', language: language.toLowerCase().startsWith('en') ? 'en' : 'fr' }
}

export function resolveReadingPlanFilters(
  params: ReadingPlanFilterParams,
  userLanguage: string
): ReadingPlanFilters {
  const language = Array.isArray(params.language) ? params.language[0] : params.language
  const search = Array.isArray(params.search) ? params.search[0] : params.search
  return {
    query: search ?? '',
    language:
      language === 'fr' || language === 'en' || language === 'all'
        ? language
        : defaultReadingPlanFilters(userLanguage).language,
  }
}

export function filterReadingPlans<
  T extends Pick<OnlinePlan, 'title' | 'subTitle' | 'description' | 'lang'>,
>(plans: readonly T[], filters: ReadingPlanFilters): T[] {
  return plans.filter(
    plan =>
      (filters.language === 'all' || plan.lang === filters.language) &&
      matchesQuery(filters.query, plan.title, plan.subTitle ?? '', plan.description ?? '')
  )
}

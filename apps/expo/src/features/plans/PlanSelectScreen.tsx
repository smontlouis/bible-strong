import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter } from 'expo-router'
import FiltersHeader from '~common/FiltersHeader'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import ReadingPlansScreen from './ReadingPlansScreen'
import {
  defaultReadingPlanFilters,
  resolveReadingPlanFilters,
  type ReadingPlanFilterParams,
} from './readingPlanFilters'

const PlanSelect = () => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const params = useLocalSearchParams<ReadingPlanFilterParams>()
  const userLanguage = i18n.language
  const filters = resolveReadingPlanFilters(params, userLanguage)
  return (
    <Container>
      <FiltersHeader
        hasBackButton
        title={t('readingPlans.tab')}
        onReset={() =>
          router.setParams({
            search: '',
            language: defaultReadingPlanFilters(userLanguage).language,
          })
        }
        filters={[
          {
            key: 'search',
            icon: 'search',
            label: t('Rechercher'),
            value: filters.query,
            active: Boolean(filters.query.trim()),
            onPress: () => {},
            content: () => (
              <PanelSearch
                value={filters.query}
                onChange={query => router.setParams({ search: query, language: filters.language })}
              />
            ),
          },
          {
            key: 'language',
            icon: 'globe',
            label: t('menu.language'),
            value: t(
              filters.language === 'all'
                ? 'Tout'
                : filters.language === 'fr'
                  ? 'Français'
                  : 'Anglais'
            ),
            active: filters.language !== 'all',
            onPress: () => {},
            options: (['fr', 'en', 'all'] as const).map(language => ({
              key: language,
              label: t(language === 'all' ? 'Tout' : language === 'fr' ? 'Français' : 'Anglais'),
              selected: filters.language === language,
              onSelect: () => router.setParams({ language, search: filters.query }),
            })),
          },
        ]}
      />
      <Box className="w-full flex-1 bg-light-grey">
        <ReadingPlansScreen filters={filters} />
      </Box>
    </Container>
  )
}
export default PlanSelect

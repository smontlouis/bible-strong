import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useResourceAccess } from '~features/resources/resourceAccess'
import StrongEntityPage from './StrongEntityPage'
import StrongEntryRouteScaffold from './StrongEntryRouteScaffold'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { useStrongEntryRoute } from './useStrongEntryRoute'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'
import { useStrongReadingTypography } from './useStrongReadingTypography'
import { useStrongRouteNavigation } from './useStrongRouteNavigation'

type Props = {
  context: StrongDetailRouteContext
  entityKey?: string
  isFormSheet?: boolean
}

const StrongEntityRouteScreen = ({ context, entityKey, isFormSheet = false }: Props) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const readingTypography = useStrongReadingTypography()
  const { language } = useStrongLexiconLanguage()
  const navigation = useStrongRouteNavigation(context)
  const entryState = useStrongEntryRoute(context)
  const availabilityQuery = useQuery({
    queryKey: ['strong-lexicon', 'availability', 'entities'],
    queryFn: () => resources.strongLexicon.getModuleAvailability('entities'),
    networkMode: 'always',
  })
  const entityQuery = useQuery({
    queryKey: ['strong-lexicon', 'entity', language, entityKey],
    queryFn: () => resources.strongLexicon.loadEntity(entityKey!, language),
    enabled: Boolean(entityKey && availabilityQuery.data?.status === 'available'),
    networkMode: 'always',
  })
  const availability = availabilityQuery.data ?? {
    status: 'missing' as const,
    moduleId: 'entities' as const,
  }

  return (
    <StrongEntryRouteScaffold
      context={context}
      entryState={entryState}
      isFormSheet={isFormSheet}
      requireEntry={false}
      title={entityQuery.data?.name ?? t('strongDetail.entity.title')}
    >
      <StrongEntityPage
        entity={entityQuery.data}
        readingTypography={readingTypography}
        loading={
          availabilityQuery.isPending ||
          (Boolean(entityKey) && availability.status === 'available' && entityQuery.isPending)
        }
        onOpenBibleReference={navigation.openBibleReference}
        onOpenStrong={navigation.openStrong}
        onOpenEntityProfile={navigation.openEntity}
        onOpenEntityRelation={navigation.openEntityRelation}
      />
    </StrongEntryRouteScaffold>
  )
}

export default StrongEntityRouteScreen

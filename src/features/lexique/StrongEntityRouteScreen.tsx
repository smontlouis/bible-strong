import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import Header from '~common/Header'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import type { StrongLexiconEntityRelation } from '~features/resources/strongLexiconAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import StrongEntityPage from './StrongEntityPage'
import { createStrongDetailRoute, type StrongDetailRouteContext } from './strongDetailRoutes'
import { getBibleViewRouteForStrongOsisReference } from './strongReferenceNavigation'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'

type Props = {
  context: StrongDetailRouteContext
  entityKey?: string
  isFormSheet?: boolean
}

const StrongEntityRouteScreen = ({ context, entityKey, isFormSheet = false }: Props) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const pushRouteOnce = usePushRouteOnce()
  const canGoBackInStack = useCanGoBackInStack()
  const { language } = useStrongLexiconLanguage()
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

  const openBibleReference = (osis: string) => {
    const route = getBibleViewRouteForStrongOsisReference(osis)
    if (route) pushRouteOnce(route)
  }

  const openStrong = (stepCode: string) => {
    pushRouteOnce(
      createStrongDetailRoute('index', {
        book: stepCode.startsWith('G') ? 40 : 1,
        identityKind: 'dstrong',
        identityCode: stepCode,
        reference: stepCode,
        strongBibleVersionId: context.strongBibleVersionId,
        bibleVersion: context.bibleVersion,
      })
    )
  }

  const openEntityRelation = (relation: StrongLexiconEntityRelation) => {
    if (!relation.targetUniqueName) return
    pushRouteOnce(
      createStrongDetailRoute('entity', context, {
        entityKey: relation.targetUniqueName,
      })
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={isFormSheet ? canGoBackInStack : true}
        title={entityQuery.data?.name ?? t('strongDetail.entity.title')}
      />
      <StrongEntityPage
        entity={entityQuery.data}
        availability={availability}
        loading={
          availabilityQuery.isPending ||
          (Boolean(entityKey) && availability.status === 'available' && entityQuery.isPending)
        }
        onOpenBibleReference={openBibleReference}
        onOpenStrong={openStrong}
        onOpenEntityRelation={openEntityRelation}
      />
    </FormSheetScreen>
  )
}

export default StrongEntityRouteScreen

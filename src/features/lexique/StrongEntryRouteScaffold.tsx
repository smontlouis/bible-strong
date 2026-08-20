import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import EntityChipList from '~common/EntityChipList'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { createStrongEndpoint } from '~features/studyRelations/endpoints'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import type { RootState } from '~redux/modules/reducer'
import { makeStrongTagsSelector } from '~redux/selectors/bible'
import StrongEntryMenu from './StrongEntryMenu'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { useStrongEntryRoute } from './useStrongEntryRoute'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  resourceFailureFromAccessError,
  resourceFailureFromStrongModuleAvailability,
} from '~features/resources/resourceFailure'

type StrongEntryLoadState = Pick<
  ReturnType<typeof useStrongEntryRoute>,
  'identity' | 'coreAvailability' | 'entryQuery' | 'entry'
>

type Props = {
  children: ReactNode
  context: StrongDetailRouteContext
  entryState: StrongEntryLoadState
  fontSize?: number
  hasBackButton?: boolean
  isFormSheet?: boolean
  onBack?: () => void
  requireEntry?: boolean
  showEntryMenu?: boolean
  subTitle?: string
  title: string
}

const StrongEntryRouteScaffold = ({
  children,
  context,
  entryState,
  fontSize,
  hasBackButton,
  isFormSheet = false,
  onBack,
  requireEntry = true,
  showEntryMenu = false,
  subTitle,
  title,
}: Props) => {
  const { t } = useTranslation()
  const canGoBackInStack = useCanGoBackInStack()
  const selectStrongTags = makeStrongTagsSelector()
  const tags = useSelector((state: RootState) =>
    entryState.entry
      ? selectStrongTags(state, entryState.entry.stepCode, entryState.entry.language === 'greek')
      : undefined
  )
  const strongEndpoint = entryState.entry
    ? createStrongEndpoint({
        language: entryState.entry.language,
        code: entryState.entry.stepCode,
        labelFallback: entryState.entry.gloss,
        originalWord: entryState.entry.original,
      })
    : null
  const relationCount = useRelationCount(strongEndpoint)
  const openEntityRelations = useOpenEntityRelations()
  const header = (
    <Header
      hasBackButton={hasBackButton ?? (onBack ? true : isFormSheet ? canGoBackInStack : true)}
      onCustomBackPress={onBack}
      fontSize={fontSize}
      subTitle={subTitle}
      title={title}
      rightComponent={
        showEntryMenu && entryState.entry ? (
          <StrongEntryMenu context={context} entry={entryState.entry} />
        ) : undefined
      }
    >
      {entryState.entry && (tags || relationCount > 0) && (
        <Box px={20} mt={-8} pb={10}>
          <EntityChipList
            tags={tags}
            relationCount={relationCount}
            onRelationPress={() => strongEndpoint && openEntityRelations(strongEndpoint)}
          />
        </Box>
      )}
    </Header>
  )

  if (
    requireEntry &&
    (entryState.coreAvailability.isPending ||
      (Boolean(entryState.identity) &&
        entryState.coreAvailability.data?.status === 'available' &&
        entryState.entryQuery.isPending))
  ) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        {header}
        {entryState.entryQuery.isError ? (
          <Empty
            source={require('~assets/images/empty.json')}
            message={t("Cette entrée Strong n'a pas pu être chargée.")}
          />
        ) : (
          <Loading message={t('Chargement...')} />
        )}
      </FormSheetScreen>
    )
  }

  if (requireEntry && entryState.coreAvailability.isError) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        {header}
        <ResourceUnavailableView
          title={t('resource.strong.temporarilyUnavailable')}
          failure={resourceFailureFromAccessError(entryState.coreAvailability.error)}
          onRetry={() => void entryState.coreAvailability.refetch()}
        />
      </FormSheetScreen>
    )
  }

  if (
    requireEntry &&
    entryState.coreAvailability.data &&
    entryState.coreAvailability.data.status !== 'available'
  ) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        {header}
        <ResourceUnavailableView
          identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
          title={t('resource.strong.coreUnavailable')}
          fileSize={35}
          failure={resourceFailureFromStrongModuleAvailability(entryState.coreAvailability.data)}
          onRetry={() => void entryState.coreAvailability.refetch()}
        />
      </FormSheetScreen>
    )
  }

  if (requireEntry && entryState.entryQuery.isError) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        {header}
        <ResourceUnavailableView
          title={t("Cette entrée Strong n'a pas pu être chargée.")}
          failure={resourceFailureFromAccessError(entryState.entryQuery.error)}
          onRetry={() => void entryState.entryQuery.refetch()}
        />
      </FormSheetScreen>
    )
  }

  if (requireEntry && !entryState.entry) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        {header}
        <Empty
          source={require('~assets/images/empty.json')}
          message={t('Aucune entrée lexicale trouvée pour {{code}}.', {
            code: entryState.identity?.code ?? '',
          })}
        />
      </FormSheetScreen>
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      {header}
      {children}
    </FormSheetScreen>
  )
}

export default StrongEntryRouteScaffold

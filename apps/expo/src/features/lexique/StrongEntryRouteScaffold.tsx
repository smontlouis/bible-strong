import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
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
    />
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
          <Empty message={t("Cette entrée Strong n'a pas pu être chargée.")} />
        ) : (
          <Loading message={t('Chargement...')} />
        )}
      </FormSheetScreen>
    )
  }

  if (requireEntry && entryState.coreAvailability.isError) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Box className="overflow-hidden border-continuous flex-[1]">
          {header}
          <ResourceUnavailableView
            title={t('resource.strong.temporarilyUnavailable')}
            failure={resourceFailureFromAccessError(entryState.coreAvailability.error)}
            onRetry={() => void entryState.coreAvailability.refetch()}
          />
        </Box>
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
        <Box className="overflow-hidden border-continuous flex-[1]">
          {header}
          <ResourceUnavailableView
            identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
            title={t('resource.strong.coreUnavailable')}
            offlineTitle={t('resource.strong.temporarilyUnavailable')}
            fileSize={35}
            failure={resourceFailureFromStrongModuleAvailability(entryState.coreAvailability.data)}
            onRetry={() => void entryState.coreAvailability.refetch()}
          />
        </Box>
      </FormSheetScreen>
    )
  }

  if (requireEntry && entryState.entryQuery.isError) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Box className="overflow-hidden border-continuous flex-[1]">
          {header}
          <ResourceUnavailableView
            title={t("Cette entrée Strong n'a pas pu être chargée.")}
            failure={resourceFailureFromAccessError(entryState.entryQuery.error)}
            onRetry={() => void entryState.entryQuery.refetch()}
          />
        </Box>
      </FormSheetScreen>
    )
  }

  if (requireEntry && !entryState.entry) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        {header}
        <Empty
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

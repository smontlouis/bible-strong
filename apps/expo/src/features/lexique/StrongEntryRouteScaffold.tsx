import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'
import { getSimpleStrongModuleId } from '@bible-strong/resource-domain/strong-lexicon'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import { twMerge } from '~common/ui/classNames'
import { formatStrongDisplayCode } from '~helpers/strongIdentities'
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
  /**
   * The ground of the page, given to its root wrapper so the status bar and the space above the
   * tab bar follow it: the canvas for a page of cards, nothing for a continuous list.
   */
  className?: string
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
  className,
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
  const { language } = useStrongLexiconLanguage()
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
  // A form sheet has no container of its own: the box inside carries the ground there.
  const screen = (content: ReactNode) => (
    <FormSheetScreen className={className} isFormSheet={isFormSheet}>
      <Box className={twMerge('overflow-hidden border-continuous flex-[1]', className)}>
        {header}
        {content}
      </Box>
    </FormSheetScreen>
  )

  if (
    requireEntry &&
    (entryState.coreAvailability.isPending ||
      (Boolean(entryState.identity) &&
        entryState.coreAvailability.data?.status === 'available' &&
        entryState.entryQuery.isPending))
  ) {
    return screen(
      entryState.entryQuery.isError ? (
        <Empty message={t("Cette entrée Strong n'a pas pu être chargée.")} />
      ) : (
        <Loading message={t('Chargement...')} />
      )
    )
  }

  if (requireEntry && entryState.coreAvailability.isError) {
    return screen(
      <ResourceUnavailableView
        title={t('resource.strong.temporarilyUnavailable')}
        failure={resourceFailureFromAccessError(entryState.coreAvailability.error)}
        onRetry={() => void entryState.coreAvailability.refetch()}
      />
    )
  }

  if (
    requireEntry &&
    entryState.coreAvailability.data &&
    entryState.coreAvailability.data.status !== 'available'
  ) {
    return screen(
      <ResourceUnavailableView
        identity={{
          kind: 'strong-lexicon-module',
          moduleId: getSimpleStrongModuleId(language),
        }}
        title={t('resource.strong.coreUnavailable')}
        offlineTitle={t('resource.strong.temporarilyUnavailable')}
        fileSize={35}
        failure={resourceFailureFromStrongModuleAvailability(entryState.coreAvailability.data)}
        onRetry={() => void entryState.coreAvailability.refetch()}
      />
    )
  }

  if (requireEntry && entryState.entryQuery.isError) {
    return screen(
      <ResourceUnavailableView
        title={t("Cette entrée Strong n'a pas pu être chargée.")}
        failure={resourceFailureFromAccessError(entryState.entryQuery.error)}
        onRetry={() => void entryState.entryQuery.refetch()}
      />
    )
  }

  if (requireEntry && !entryState.entry) {
    return screen(
      <Empty
        message={t('Aucune entrée lexicale trouvée pour {{code}}.', {
          code: formatStrongDisplayCode(entryState.identity?.code ?? ''),
        })}
      />
    )
  }

  return screen(children)
}

export default StrongEntryRouteScaffold

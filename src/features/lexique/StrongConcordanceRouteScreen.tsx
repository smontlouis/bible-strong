import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import type { RootState } from '~redux/modules/reducer'
import { resolveStrongBibleVersionId } from './resolveStrongBibleVersionId'
import StrongConcordancePage from './StrongConcordancePage'
import StrongEntryRouteScaffold from './StrongEntryRouteScaffold'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { useStrongEntryRoute } from './useStrongEntryRoute'
import { useStrongRouteNavigation } from './useStrongRouteNavigation'

type Props = {
  context: StrongDetailRouteContext
  isFormSheet?: boolean
}

const StrongConcordanceRouteScreen = ({ context, isFormSheet }: Props) => {
  const { t } = useTranslation()
  const navigation = useStrongRouteNavigation(context)
  const entryState = useStrongEntryRoute(context)
  const defaultVersionId = useSelector(
    (state: RootState) => state.user.bible.settings.defaultStrongBibleVersionId ?? 'LSG'
  )
  const currentVersionId = resolveStrongBibleVersionId(context, defaultVersionId)

  return (
    <StrongEntryRouteScaffold
      context={context}
      entryState={entryState}
      isFormSheet={isFormSheet}
      showEntryMenu={false}
      title={t('Concordance')}
    >
      {entryState.entry && (
        <StrongConcordancePage
          entry={entryState.entry}
          currentVersionId={currentVersionId}
          defaultVersionId={defaultVersionId}
          preferredInterlinearLocale={entryState.languageState.language}
          onOpenVerse={navigation.openConcordanceVerse}
        />
      )}
    </StrongEntryRouteScaffold>
  )
}

export default StrongConcordanceRouteScreen

import { useTranslation } from 'react-i18next'
import { formatStrongDisplayCode } from '~helpers/strongIdentities'

import StrongDictionaryPage from './StrongDictionaryPage'
import StrongEntryRouteScaffold from './StrongEntryRouteScaffold'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { useStrongEntryRoute } from './useStrongEntryRoute'
import { useStrongRouteNavigation } from './useStrongRouteNavigation'

type Props = {
  context: StrongDetailRouteContext
  isFormSheet?: boolean
}

const StrongDictionaryRouteScreen = ({ context, isFormSheet }: Props) => {
  const { t } = useTranslation()
  const navigation = useStrongRouteNavigation(context)
  const entryState = useStrongEntryRoute(context)

  return (
    <StrongEntryRouteScaffold
      className="bg-canvas"
      context={context}
      entryState={entryState}
      isFormSheet={isFormSheet}
      subTitle={
        entryState.entry
          ? [
              formatStrongDisplayCode(entryState.entry.stepCode),
              entryState.entry.original,
              entryState.entry.gloss,
            ]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
      title={t('strongLexicon.greekDictionary')}
    >
      {entryState.entry && (
        <StrongDictionaryPage
          entry={entryState.entry}
          onOpenBibleReference={navigation.openBibleReference}
          onOpenStrong={navigation.openStrong}
        />
      )}
    </StrongEntryRouteScaffold>
  )
}

export default StrongDictionaryRouteScreen

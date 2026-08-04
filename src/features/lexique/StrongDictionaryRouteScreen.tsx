import { useTranslation } from 'react-i18next'

import StrongDictionaryPage from './StrongDictionaryPage'
import StrongEntryRouteScaffold from './StrongEntryRouteScaffold'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { useStrongEntryRoute } from './useStrongEntryRoute'
import { useStrongReadingTypography } from './useStrongReadingTypography'
import { useStrongRouteNavigation } from './useStrongRouteNavigation'

type Props = {
  context: StrongDetailRouteContext
  isFormSheet?: boolean
}

const StrongDictionaryRouteScreen = ({ context, isFormSheet }: Props) => {
  const { t } = useTranslation()
  const readingTypography = useStrongReadingTypography()
  const navigation = useStrongRouteNavigation(context)
  const entryState = useStrongEntryRoute(context)

  return (
    <StrongEntryRouteScaffold
      context={context}
      entryState={entryState}
      isFormSheet={isFormSheet}
      subTitle={
        entryState.entry
          ? [entryState.entry.stepCode, entryState.entry.original, entryState.entry.gloss]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
      title={t('strongLexicon.greekDictionary')}
    >
      {entryState.entry && (
        <StrongDictionaryPage
          entry={entryState.entry}
          availability={entryState.entry.modules.resources}
          readingTypography={readingTypography}
          onOpenBibleReference={navigation.openBibleReference}
          onOpenStrong={navigation.openStrong}
        />
      )}
    </StrongEntryRouteScaffold>
  )
}

export default StrongDictionaryRouteScreen

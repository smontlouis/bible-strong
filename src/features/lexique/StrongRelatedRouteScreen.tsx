import { useTranslation } from 'react-i18next'

import StrongEntryRouteScaffold from './StrongEntryRouteScaffold'
import StrongRelatedPage from './StrongRelatedPage'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { useStrongEntryRoute } from './useStrongEntryRoute'
import { useStrongReadingTypography } from './useStrongReadingTypography'
import { useStrongRouteNavigation } from './useStrongRouteNavigation'

type Props = {
  context: StrongDetailRouteContext
  isFormSheet?: boolean
}

const StrongRelatedRouteScreen = ({ context, isFormSheet }: Props) => {
  const { t } = useTranslation()
  const readingTypography = useStrongReadingTypography()
  const navigation = useStrongRouteNavigation(context)
  const entryState = useStrongEntryRoute(context)

  return (
    <StrongEntryRouteScaffold
      context={context}
      entryState={entryState}
      isFormSheet={isFormSheet}
      title={t('strongDetail.related.title')}
    >
      {entryState.entry && (
        <StrongRelatedPage
          entry={entryState.entry}
          readingTypography={readingTypography}
          onOpenStrong={navigation.openStrong}
        />
      )}
    </StrongEntryRouteScaffold>
  )
}

export default StrongRelatedRouteScreen

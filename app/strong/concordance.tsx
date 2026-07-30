import StrongConcordanceRouteScreen from '~features/lexique/StrongConcordanceRouteScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'

const StrongConcordanceRoute = () => {
  const route = useStrongRoute('concordance')

  return (
    <StrongConcordanceRouteScreen
      key={route.identity}
      context={route.context}
      isFormSheet={IS_FORM_SHEET}
    />
  )
}

export default StrongConcordanceRoute

import StrongDetailRouteScreen from '~features/lexique/StrongDetailRouteScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'

const StrongConcordanceRoute = () => {
  const route = useStrongRoute('concordance')

  return (
    <StrongDetailRouteScreen
      key={route.identity}
      context={route.context}
      isFormSheet={IS_FORM_SHEET}
      page="concordance"
    />
  )
}

export default StrongConcordanceRoute

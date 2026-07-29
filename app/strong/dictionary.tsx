import StrongDetailRouteScreen from '~features/lexique/StrongDetailRouteScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'

const StrongDictionaryRoute = () => {
  const route = useStrongRoute('dictionary')

  return (
    <StrongDetailRouteScreen
      key={route.identity}
      context={route.context}
      isFormSheet={IS_FORM_SHEET}
      page="dictionary"
    />
  )
}

export default StrongDictionaryRoute

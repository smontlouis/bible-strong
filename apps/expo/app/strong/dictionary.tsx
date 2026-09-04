import StrongDictionaryRouteScreen from '~features/lexique/StrongDictionaryRouteScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'

const StrongDictionaryRoute = () => {
  const route = useStrongRoute('dictionary')

  return (
    <StrongDictionaryRouteScreen
      key={route.identity}
      context={route.context}
      isFormSheet={IS_FORM_SHEET}
    />
  )
}

export default StrongDictionaryRoute

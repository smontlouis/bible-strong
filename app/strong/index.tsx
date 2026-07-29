import StrongDetailRouteScreen from '~features/lexique/StrongDetailRouteScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'

const StrongRoute = () => {
  const route = useStrongRoute('index')

  return (
    <StrongDetailRouteScreen
      key={route.identity}
      context={route.context}
      isFormSheet={IS_FORM_SHEET}
      page="index"
    />
  )
}

export default StrongRoute

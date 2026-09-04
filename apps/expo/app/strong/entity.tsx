import StrongEntityRouteScreen from '~features/lexique/StrongEntityRouteScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'

const StrongEntityRoute = () => {
  const route = useStrongRoute('entity')

  return (
    <StrongEntityRouteScreen
      key={route.identity}
      context={route.context}
      entityKey={route.entityKey}
      isFormSheet={IS_FORM_SHEET}
    />
  )
}

export default StrongEntityRoute

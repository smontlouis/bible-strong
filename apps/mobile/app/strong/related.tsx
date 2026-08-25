import StrongRelatedRouteScreen from '~features/lexique/StrongRelatedRouteScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'

const StrongRelatedRoute = () => {
  const route = useStrongRoute('related')

  return (
    <StrongRelatedRouteScreen
      key={route.identity}
      context={route.context}
      isFormSheet={IS_FORM_SHEET}
    />
  )
}

export default StrongRelatedRoute

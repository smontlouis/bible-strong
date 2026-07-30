import StrongMainScreen from '~features/lexique/StrongMainScreen'
import { useStrongRoute } from '~features/lexique/useStrongRoute'
import { IS_FORM_SHEET } from '~helpers/constants'

const StrongRoute = () => {
  const route = useStrongRoute('index')

  return (
    <StrongMainScreen key={route.identity} context={route.context} isFormSheet={IS_FORM_SHEET} />
  )
}

export default StrongRoute

import BibleScreen from '~features/bible/BibleScreen'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const LegacyBibleRoute = () => (
  <LegacyPublicRouteRedirect pathname="/bible-view">
    <BibleScreen />
  </LegacyPublicRouteRedirect>
)

export default LegacyBibleRoute

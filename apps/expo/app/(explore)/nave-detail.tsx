import NaveDetailScreen from '~features/nave/NaveDetailScreen'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const LegacyNaveRoute = () => (
  <LegacyPublicRouteRedirect pathname="/nave-detail">
    <NaveDetailScreen />
  </LegacyPublicRouteRedirect>
)

export default LegacyNaveRoute

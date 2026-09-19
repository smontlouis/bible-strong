import DictionaryDetailScreen from '~features/dictionnary/DictionaryDetailScreen'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const LegacyDictionaryRoute = () => (
  <LegacyPublicRouteRedirect pathname="/dictionnary-detail">
    <DictionaryDetailScreen />
  </LegacyPublicRouteRedirect>
)

export default LegacyDictionaryRoute

import EventScreen from '~features/timeline/EventScreen'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const LegacyTimelineEventRoute = () => (
  <LegacyPublicRouteRedirect pathname="/event">
    <EventScreen />
  </LegacyPublicRouteRedirect>
)

export default LegacyTimelineEventRoute

import TimelineHomeScreen from '~features/timeline/TimelineHomeScreen'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const TimelineHomeRoute = () => (
  <LegacyPublicRouteRedirect pathname="/timeline-home">
    <TimelineHomeScreen />
  </LegacyPublicRouteRedirect>
)

export default TimelineHomeRoute

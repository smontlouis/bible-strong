import TimelineStageScreen from '~features/timeline/TimelineStageScreen'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const TimelineHomeRoute = () => (
  <LegacyPublicRouteRedirect pathname="/timeline-home">
    <TimelineStageScreen />
  </LegacyPublicRouteRedirect>
)

export default TimelineHomeRoute

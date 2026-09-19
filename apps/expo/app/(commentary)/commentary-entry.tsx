import CommentaryEntryScreen from '~features/commentaries/CommentaryEntryScreen'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const LegacyCommentaryEntryRoute = () => (
  <LegacyPublicRouteRedirect pathname="/commentary-entry">
    <CommentaryEntryScreen />
  </LegacyPublicRouteRedirect>
)

export default LegacyCommentaryEntryRoute

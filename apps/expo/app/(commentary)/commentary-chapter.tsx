import CommentaryChapterScreen from '~features/commentaries/CommentaryChapterScreen'
import { LegacyPublicRouteRedirect } from '~navigation/LegacyPublicRouteRedirect'

const LegacyCommentaryChapterRoute = () => (
  <LegacyPublicRouteRedirect pathname="/commentary-chapter">
    <CommentaryChapterScreen />
  </LegacyPublicRouteRedirect>
)

export default LegacyCommentaryChapterRoute

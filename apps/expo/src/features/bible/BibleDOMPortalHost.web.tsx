import type { StyleProp, ViewStyle } from 'react-native'

type BibleDOMPortalHostProps = {
  name: string
  style?: StyleProp<ViewStyle>
}

// Web renders one inline DOM component per Bible tab. The shared native
// WebView host is intentionally absent from the web bundle.
const BibleDOMPortalHost = (_props: BibleDOMPortalHostProps) => null

export default BibleDOMPortalHost

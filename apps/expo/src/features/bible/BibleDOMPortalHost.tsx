import type { StyleProp, ViewStyle } from 'react-native'
import { PortalHost } from 'react-native-teleport'

type BibleDOMPortalHostProps = {
  name: string
  style?: StyleProp<ViewStyle>
}

const BibleDOMPortalHost = (props: BibleDOMPortalHostProps) => <PortalHost {...props} />

export default BibleDOMPortalHost

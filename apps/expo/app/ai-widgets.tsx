import { Redirect } from 'expo-router'
import WidgetsPlayground from '~features/study-assistant/playground/WidgetsPlayground'
export default function AIWidgetsRoute() {
  if (!__DEV__) return <Redirect href="/" />
  return <WidgetsPlayground />
}

import { Redirect } from 'expo-router'

/**
 * The route holds the native assistant page. On the web the assistant is the floating panel
 * (AssistantLauncher.web), so an address typed by hand leads home, where the panel opens.
 */
export default function StudyAssistantScreen() {
  return <Redirect href="/" />
}

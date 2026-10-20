import { useWindowDimensions } from 'react-native'

// Below the tablet width, the web keeps the sheet of the phone.
const DESKTOP_MIN_WIDTH = 768

/** Wide windows show the selection as a menu beside the verse rather than as a sheet. */
export default function useSelectionMenuLayout() {
  return useWindowDimensions().width >= DESKTOP_MIN_WIDTH
}

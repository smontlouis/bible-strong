import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { WithoutWorkspaceHeaderInset } from '~features/app-switcher/workspaceHeaderInset'

// iOS opens these routes in a sheet, away from the sidebar button. Android opens them as pages
// beneath it (createFormSheetOptions), so their headers keep its room.
const ModalRouteFrame = ({ children }: { children: ReactNode }) =>
  Platform.OS === 'ios' ? (
    <WithoutWorkspaceHeaderInset>{children}</WithoutWorkspaceHeaderInset>
  ) : (
    children
  )

export default ModalRouteFrame

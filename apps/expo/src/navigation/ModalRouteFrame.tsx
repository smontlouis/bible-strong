import type { ReactNode } from 'react'
import { WithoutWorkspaceHeaderInset } from '~features/app-switcher/workspaceHeaderInset'

const ModalRouteFrame = ({ children }: { children: ReactNode }) => (
  <WithoutWorkspaceHeaderInset>{children}</WithoutWorkspaceHeaderInset>
)

export default ModalRouteFrame

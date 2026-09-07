import type { ReactNode } from 'react'

// Web routes occupy the persistent workspace's content area. Contextual dialogs
// still use the shared sheet components, but whole routes are no longer dialogs.
const ModalRouteFrame = ({ children }: { children: ReactNode }) => children

export default ModalRouteFrame

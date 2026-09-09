import type { ReactNode } from 'react'
import type { TabGroup } from '~state/tabs'
export type SidebarDragProviderProps = {
  children: (groups?: TabGroup[], foldedGroupId?: string) => ReactNode
  onExpandGroup: (id: string) => void
}
export type SidebarDragGroupProps = { children: ReactNode; groupId: string; isDefault?: boolean }
export type SidebarDragTabProps = { children: ReactNode; groupId: string; tabId: string }
export function SidebarDragProvider({ children }: SidebarDragProviderProps) {
  return <>{children()}</>
}
export function SidebarDragGroup({ children }: SidebarDragGroupProps) {
  return <>{children}</>
}
export function SidebarDragGroupHandle({ children }: SidebarDragGroupProps) {
  return <>{children}</>
}
export function SidebarDragTab({ children }: SidebarDragTabProps) {
  return <>{children}</>
}

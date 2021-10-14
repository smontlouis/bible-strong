import { proxy } from 'valtio'

export interface Diff {
  added?: {
    [x: string]: any
  }
  updated?: any
  deleted?: any
}

export type ConflictEntity =
  | 'highlights'
  | 'tags'
  | 'words'
  | 'naves'
  | 'strongsHebreu'
  | 'strongsGrec'
  | 'notes'
  | 'studies'
  | 'plan'
  | 'settings'

export interface ConflictItem {
  content: string
  children?: ConflictItem[]
}

export interface ConflictParent extends ConflictItem {
  entity: ConflictEntity
}

interface Conflict {
  diff?: Diff
  onDispatchUserSuccess?: Function
  lastSeen?: number
  remoteLastSeen?: number
}
export const conflictStateProxy: Conflict = proxy({
  diff: undefined,
  onDispatchUserSuccess: undefined,
  lastSeen: undefined,
  remoteLastSeen: undefined,
})
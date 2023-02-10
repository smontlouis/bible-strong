import { atom } from 'jotai/vanilla'

export type ResourceToDownload = {
  id: string
  name: string
  path: string
  uri: string
  fileSize: number
}

export const selectedResourcesAtom = atom<ResourceToDownload[]>([])

import { atom } from 'jotai/vanilla'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

export type ResourceToDownload = {
  id: string
  name: string
  path: string
  uri: string
  fileSize: number
}

export const selectedResourcesAtom = atom<ResourceToDownload[]>([])

// Tracks onboarding completion state: true = completed (Bible downloaded), false = not completed
// Persisted in MMKV for instant access on app restart
export const isOnboardingCompletedAtom = atomWithAsyncStorage<boolean>(
  'isOnboardingCompleted',
  false
)

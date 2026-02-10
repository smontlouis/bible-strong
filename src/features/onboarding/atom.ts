import { atom } from 'jotai/vanilla'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

export type ResourceToDownload = {
  id: string
  name: string
  path: string
  uri: string
  fileSize: number
  type: 'bible' | 'database'  // Discriminate between resource types
  lang?: string               // Language for database downloads (required for databases)
}

export const selectedResourcesAtom = atom<ResourceToDownload[]>([])

// Tracks onboarding completion state: true = completed (Bible downloaded), false = not completed
// Persisted in MMKV for instant access on app restart
export const isOnboardingCompletedAtom = atomWithAsyncStorage<boolean>(
  'isOnboardingCompleted',
  false
)

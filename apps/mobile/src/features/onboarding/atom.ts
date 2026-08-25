import { atom } from 'jotai/vanilla'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import type { OnboardingResourceSelection } from './onboardingResources'

export const selectedResourcesAtom = atom<OnboardingResourceSelection[]>([])

// Tracks whether the optional introduction was completed or dismissed.
// Persisted in MMKV for instant access on app restart
export const isOnboardingCompletedAtom = atomWithAsyncStorage<boolean>(
  'isOnboardingCompleted',
  false
)

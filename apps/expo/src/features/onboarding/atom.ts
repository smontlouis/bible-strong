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

// The reader asked to try Strobi during the onboarding: once it is over, the app offers it.
export const strobiTrialRequestedAtom = atomWithAsyncStorage<boolean>('strobiTrialRequested', false)

// The onboarding was closed during this session: what it asked for can follow.
export const onboardingFinishedAtom = atom(false)

// The onboarding fills the screen: what waits for its end (Strobi's trial) does not start under it.
export const onboardingOnScreenAtom = atom(false)

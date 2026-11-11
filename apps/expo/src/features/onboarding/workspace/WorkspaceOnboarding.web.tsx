import { AnimatePresence } from 'motion/react'
import { usePathname, useRouter } from 'expo-router'
import { useAtom } from 'jotai/react'
import { useEffect, useRef, useState } from 'react'
import { useDispatch, useStore } from 'react-redux'

import { getIncomingLinkAtLoad } from '~features/app-switcher/IncomingLinkGate'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { getWorkspacePageForPath } from '~features/app-switcher/workspaceRoutes'
import AbelOnboarding from '~features/onboarding/AbelOnboarding'
import { isOnboardingCompletedAtom } from '~features/onboarding/atom'
import { isOnboardingForced } from '~helpers/runtimeConfig'
import { saveAllLogsAsSeen } from '~redux/modules/user'
import type { RootState } from '~redux/modules/reducer'

import { decideWorkspaceOnboarding, isExistingUser } from './decideWorkspaceOnboarding'
import { workspaceOnboardingViewAtom } from './state'
import { workspaceTourStatusAtom } from './tourStatus'
import { trackOnboarding } from './trackOnboarding'
import WorkspaceStory, { type StoryEnd } from './WorkspaceStory.web'
import { WorkspaceInviteCard, WorkspaceTourCard } from './WorkspaceTour.web'
import './workspace-onboarding.css'

/** The tour card waits for the workspace to settle before it shows. */
const TOUR_DELAY_MS = 1200

/**
 * The onboarding of the Web and the desktop app: the story over the whole window on a first
 * visit (the mobile story in a narrow window), then the tour card in the real workspace. A
 * device used before only gets the tour; a first visit opened on a shared link gets an
 * invitation card, and the story waits for the next visit.
 */
export default function WorkspaceOnboarding() {
  const [view, setView] = useAtom(workspaceOnboardingViewAtom)
  const [completed, setCompleted] = useAtom(isOnboardingCompletedAtom)
  const [tourStatus, setTourStatus] = useAtom(workspaceTourStatusAtom)
  const store = useStore<RootState>()
  const dispatch = useDispatch()
  const router = useRouter()
  const pathname = usePathname()
  const wide = useResponsiveWorkspace()
  // Decided once per page load, from what the device held when the page opened.
  const [decision] = useState(() =>
    isOnboardingForced
      ? { view: 'story' as const, markCompleted: false }
      : decideWorkspaceOnboarding({
          completed,
          existingUser: isExistingUser(store.getState()),
          incomingLink: getIncomingLinkAtLoad() !== undefined,
          wide,
          tourStatus,
        })
  )
  // A story played again from the help keeps the device's changelog as it was.
  const firstStory = useRef(!completed && !decision.markCompleted)

  useEffect(() => {
    if (decision.markCompleted) setCompleted(true)
    if (decision.view !== 'tour') {
      setView(decision.view)
      return
    }
    const timer = setTimeout(
      () => setView(current => (current === 'none' ? 'tour' : current)),
      TOUR_DELAY_MS
    )
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const endStory = (end: StoryEnd) => {
    setCompleted(true)
    if (firstStory.current) {
      firstStory.current = false
      // A new reader has nothing to catch up on: the story told the app.
      const { data, isLoading } = store.getState().user.changelog
      if (!isLoading && data.length) dispatch(saveAllLogsAsSeen(data))
    }
    setTourStatus('pending')
    setView(wide ? 'tour' : 'none')
    if (end === 'signIn') router.push('/login')
  }

  const endTour = (closed: boolean) => {
    if (!closed) trackOnboarding({ flow: 'tour', step: 'done' })
    setTourStatus('done')
    setView('none')
  }

  if (view === 'story')
    return wide ? (
      <WorkspaceStory onEnd={endStory} />
    ) : (
      <div className="bs-onb-narrow">
        <AbelOnboarding onComplete={() => endStory('continue')} />
      </div>
    )

  // The tour leaves the settings pages alone: the sign-in page, above all, right after the story.
  const onSettingsPage = getWorkspacePageForPath(pathname) === 'settings'

  return (
    <AnimatePresence>
      {view === 'tour' && wide && !onSettingsPage && (
        <WorkspaceTourCard key="tour" onDone={endTour} />
      )}
      {view === 'invite' && (
        <WorkspaceInviteCard
          key="invite"
          onStart={() => {
            trackOnboarding({ flow: 'invite', step: 'invite', action: 'start' })
            setView('story')
          }}
          onLater={() => {
            trackOnboarding({ flow: 'invite', step: 'invite', action: 'later' })
            setView('none')
          }}
        />
      )}
    </AnimatePresence>
  )
}

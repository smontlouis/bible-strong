/**
 * Exposes the tools of `agentToolActions.ts` on `globalThis.__BIBLE_STRONG_AGENT__`, in
 * development only (mounted by FullAppRuntime under `__DEV__`). An agent calls them through the
 * JS debugger, for example with argent's `debugger-evaluate`:
 *
 *   __BIBLE_STRONG_AGENT__.help()
 *   __BIBLE_STRONG_AGENT__.openPassage({ reference: 'Jean 3:16' })
 *
 * Every tool returns plain JSON; a tool that cannot do its job returns `{ error }`.
 */
import { getDefaultStore } from 'jotai/vanilla'
import { useEffect } from 'react'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import {
  completedOnboardingsAtom,
  lastFeatureOnboardingClosedAtAtom,
  laterOnboardingsDecidedAtom,
} from '~features/feature-onboarding/atoms'
import { offlineResourceRegistry } from '~features/resources/resourceAvailability'
import { firestoreSyncOutbox } from '~helpers/firestoreSyncOutbox'
import { MOBILE_RESOURCE_CATALOG } from '~helpers/mobileResourceCatalog'
import { store } from '~redux/store'
import {
  isAccountMigrationOutgoingOnlyFor,
  isAccountMigrationWriteAllowedFor,
  isMigrationInProgress,
} from '~state/migration'
import {
  countUserData,
  describeOfflineResources,
  describeSyncState,
  planFeatureOnboardingsReset,
  planPassageTab,
  type FeatureOnboardingsArgs,
  type OpenPassageArgs,
} from './agentToolActions'

const TOOLS = {
  openPassage: {
    description: 'Open a Bible passage in a new tab of the reader and show it.',
    arguments: {
      reference: 'Required. As a reader writes it: « Jean 3:16 », « Rom 8 », « John 3:16-18 ».',
      bibleVersion: 'Optional Bible version code, LSG by default.',
      language: 'Optional language of the reference, "fr" (default) or "en".',
    },
  },
  syncState: {
    description:
      'Signed-in user, initial Firestore load, writes still waiting in the outbox, migration gate and the last sync events.',
    arguments: {},
  },
  userDataCounts: {
    description:
      'Counts of the highlights, word annotations, notes, bookmarks, tags, studies, links and relations of the user.',
    arguments: {},
  },
  offlineResources: {
    description: 'Offline copies on the device: id, status, update available, installed size.',
    arguments: {},
  },
  featureOnboardings: {
    description:
      'The explanations of the app (feature onboardings): which were seen, when the last one was closed (the next waits a minute). With reset, makes some unseen again and lifts the wait.',
    arguments: {
      reset: 'Optional. Ids to make unseen (verse-selection, tabs…), or "all".',
    },
  },
} as const

const readSyncState = () => {
  const state = store.getState()
  const userId = state.user.id || null
  return describeSyncState({
    state,
    pending: userId ? firestoreSyncOutbox.getPending(userId) : [],
    migration: {
      inProgress: isMigrationInProgress(),
      writeAllowed: userId ? isAccountMigrationWriteAllowedFor(userId) : null,
      outgoingOnly: userId ? isAccountMigrationOutgoingOnlyFor(userId) : null,
    },
  })
}

const featureOnboardings = ({ reset }: FeatureOnboardingsArgs = {}) => {
  const jotai = getDefaultStore()
  if (reset) {
    jotai.set(
      completedOnboardingsAtom,
      planFeatureOnboardingsReset(jotai.get(completedOnboardingsAtom), reset)
    )
    jotai.set(lastFeatureOnboardingClosedAtAtom, null)
  }
  return {
    seen: jotai.get(completedOnboardingsAtom),
    laterDecided: jotai.get(laterOnboardingsDecidedAtom),
    lastClosedAt: jotai.get(lastFeatureOnboardingClosedAtAtom),
  }
}

const createAgentApi = (openInNewTab: ReturnType<typeof useOpenInNewTab>) => ({
  help: () => TOOLS,
  openPassage: (args: OpenPassageArgs) => {
    const plan = planPassageTab(args)
    if ('error' in plan) return plan
    openInNewTab(plan.tab, { autoRedirect: true })
    return plan.passage
  },
  syncState: readSyncState,
  userDataCounts: () => countUserData(store.getState()),
  offlineResources: () =>
    describeOfflineResources(offlineResourceRegistry.getSnapshot(), MOBILE_RESOURCE_CATALOG),
  featureOnboardings,
})

declare global {
  var __BIBLE_STRONG_AGENT__: ReturnType<typeof createAgentApi> | undefined
}

const AgentTools = () => {
  const openInNewTab = useOpenInNewTab()

  // No dependency list: the API always holds the latest `openInNewTab`.
  useEffect(() => {
    globalThis.__BIBLE_STRONG_AGENT__ = createAgentApi(openInNewTab)
  })

  useEffect(
    () => () => {
      globalThis.__BIBLE_STRONG_AGENT__ = undefined
    },
    []
  )

  return null
}

export default AgentTools

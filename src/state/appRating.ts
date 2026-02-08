import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

export interface AppRatingState {
  /** Timestamp of the first app open (install proxy) */
  firstOpenDate: number
  /** Total number of app opens */
  appOpenCount: number
  /** Timestamp of last rating prompt shown */
  lastPromptDate: number | null
  /** User explicitly declined ("Non merci") */
  hasDeclined: boolean
  /** User accepted and was shown the native review dialog */
  hasRated: boolean
  /** Number of completed reading plans (cumulative) */
  completedPlansCount: number
}

const initialState: AppRatingState = {
  firstOpenDate: 0,
  appOpenCount: 0,
  lastPromptDate: null,
  hasDeclined: false,
  hasRated: false,
  completedPlansCount: 0,
}

export const appRatingAtom = atomWithAsyncStorage<AppRatingState>('appRating', initialState)

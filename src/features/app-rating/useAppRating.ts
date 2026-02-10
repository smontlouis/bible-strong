import { useAtom } from 'jotai/react'
import { useSelector } from 'react-redux'
import * as StoreReview from 'expo-store-review'
import { Linking, Platform } from 'react-native'

import { appRatingAtom, AppRatingState } from '~state/appRating'
import { RootState } from '~redux/modules/reducer'

const MIN_DAYS_BETWEEN_PROMPTS = 90
const MIN_ENGAGEMENT_SCORE = 10
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Compute an engagement score from user content counts.
 */
function computeEngagementScore(state: RootState): number {
  const { highlights, notes, studies, bookmarks } = state.user.bible

  return Math.round(
    Object.keys(highlights ?? {}).length * 1 +
      Object.keys(notes ?? {}).length * 2 +
      Object.keys(studies ?? {}).length * 3 +
      Object.keys(bookmarks ?? {}).length * 0.5
  )
}

/**
 * Check all conditions for showing the rating prompt.
 */
function canShowRatingPrompt(ratingState: AppRatingState, engagementScore: number): boolean {
  const now = Date.now()

  console.log('[AppRating] Checking conditions:', {
    hasDeclined: ratingState.hasDeclined,
    hasRated: ratingState.hasRated,
    firstOpenDate: ratingState.firstOpenDate,
    appOpenCount: ratingState.appOpenCount,
    engagementScore,
    lastPromptDate: ratingState.lastPromptDate,
  })

  // User already declined or rated
  if (ratingState.hasDeclined || ratingState.hasRated) return false

  // Must have a recorded first open
  if (ratingState.firstOpenDate === 0) return false

  // At least MIN_DAYS_BETWEEN_PROMPTS since last prompt
  if (ratingState.lastPromptDate) {
    const daysSinceLastPrompt = (now - ratingState.lastPromptDate) / DAY_MS
    if (daysSinceLastPrompt < MIN_DAYS_BETWEEN_PROMPTS) return false
  }

  // Sufficient engagement
  if (engagementScore < MIN_ENGAGEMENT_SCORE) return false

  return true
}

export type RatingTrigger = 'plan_completed' | 'engagement_milestone'

export function useAppRating() {
  const [ratingState, setRatingState] = useAtom(appRatingAtom)
  const engagementScore = useSelector(computeEngagementScore)

  /** Record an app open (call once per app launch). */
  const trackAppOpen = () => {
    setRatingState(prev => ({
      ...prev,
      firstOpenDate: prev.firstOpenDate === 0 ? Date.now() : prev.firstOpenDate,
      appOpenCount: prev.appOpenCount + 1,
    }))
  }

  /** Record a completed reading plan. */
  const trackPlanCompleted = () => {
    setRatingState(prev => ({
      ...prev,
      completedPlansCount: prev.completedPlansCount + 1,
    }))
  }

  /** Check whether a rating prompt should be shown for the given trigger. */
  const shouldShowRatingPrompt = (trigger: RatingTrigger): boolean => {
    const canShow = canShowRatingPrompt(ratingState, engagementScore)
    if (!canShow) {
      console.log(`[AppRating] canShow=false for trigger="${trigger}"`)
      return false
    }

    let result = false
    switch (trigger) {
      case 'plan_completed':
        result = true
        break
      case 'engagement_milestone':
        result = ratingState.appOpenCount >= 3 && ratingState.appOpenCount % 5 === 0
        break
    }

    console.log(`[AppRating] trigger="${trigger}" result=${result}`, {
      appOpenCount: ratingState.appOpenCount,
    })
    return result
  }

  /** User chose "Oui, noter" — trigger the native review API. */
  const acceptRating = async () => {
    setRatingState(prev => ({
      ...prev,
      hasRated: true,
      lastPromptDate: Date.now(),
    }))

    try {
      if (await StoreReview.hasAction()) {
        await StoreReview.requestReview()
      }
    } catch (e) {
      // Fallback: open store page directly
      const storeUrl =
        Platform.OS === 'ios'
          ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
          : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'

      Linking.openURL(storeUrl)
    }
  }

  /** User chose "Plus tard" — just record the prompt date. */
  const remindLater = () => {
    setRatingState(prev => ({
      ...prev,
      lastPromptDate: Date.now(),
    }))
  }

  /** User chose "Non merci" — never ask again. */
  const declineRating = () => {
    setRatingState(prev => ({
      ...prev,
      hasDeclined: true,
      lastPromptDate: Date.now(),
    }))
  }

  return {
    ratingState,
    engagementScore,
    trackAppOpen,
    trackPlanCompleted,
    shouldShowRatingPrompt,
    acceptRating,
    remindLater,
    declineRating,
  }
}

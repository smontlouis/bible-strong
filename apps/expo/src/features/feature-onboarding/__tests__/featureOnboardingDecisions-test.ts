import {
  canShowFeatureOnboarding,
  decideLaterOnboardings,
  type FeatureOnboardingSituation,
} from '../featureOnboardingDecisions'
import {
  getOnboardingConfig,
  LATER_ONBOARDING_IDS,
  ONBOARDING_IDS,
  withoutTouchDemos,
} from '../onboardingConfig'

describe('decideLaterOnboardings', () => {
  it('marks every later explanation seen for a reader who had the introduction', () => {
    expect(
      decideLaterOnboardings({
        decided: false,
        introductionCompleted: true,
        completed: [ONBOARDING_IDS.ANNOTATION_MODE],
      })
    ).toEqual([ONBOARDING_IDS.ANNOTATION_MODE, ...LATER_ONBOARDING_IDS])
  })

  it('leaves the annotation mode to a reader who never entered it', () => {
    expect(
      decideLaterOnboardings({ decided: false, introductionCompleted: true, completed: [] })
    ).not.toContain(ONBOARDING_IDS.ANNOTATION_MODE)
  })

  it('keeps every explanation for a reader who has not had the introduction', () => {
    expect(
      decideLaterOnboardings({ decided: false, introductionCompleted: false, completed: [] })
    ).toEqual([])
  })

  it('decides once: a new reader who then finishes the introduction stays new', () => {
    expect(
      decideLaterOnboardings({ decided: true, introductionCompleted: true, completed: [] })
    ).toBeNull()
  })

  it('does not repeat an explanation already seen', () => {
    const completed = [ONBOARDING_IDS.TABS]
    const decided = decideLaterOnboardings({
      decided: false,
      introductionCompleted: true,
      completed,
    })
    expect(decided?.filter(id => id === ONBOARDING_IDS.TABS)).toHaveLength(1)
  })
})

describe('canShowFeatureOnboarding', () => {
  const free: FeatureOnboardingSituation = {
    completed: [],
    shownThisSession: false,
    introductionOnScreen: false,
    modalOpen: false,
    platform: 'ios',
  }

  it('shows an explanation not seen yet', () => {
    expect(canShowFeatureOnboarding(ONBOARDING_IDS.TABS, free)).toBe(true)
  })

  it('does not show one already seen', () => {
    expect(
      canShowFeatureOnboarding(ONBOARDING_IDS.TABS, { ...free, completed: [ONBOARDING_IDS.TABS] })
    ).toBe(false)
  })

  it('shows one per session at most', () => {
    expect(canShowFeatureOnboarding(ONBOARDING_IDS.TABS, { ...free, shownThisSession: true })).toBe(
      false
    )
  })

  it('waits while the introduction or another explanation is on screen', () => {
    expect(
      canShowFeatureOnboarding(ONBOARDING_IDS.TABS, { ...free, introductionOnScreen: true })
    ).toBe(false)
    expect(canShowFeatureOnboarding(ONBOARDING_IDS.TABS, { ...free, modalOpen: true })).toBe(false)
  })

  it('keeps the touch gestures off the Web, but not the annotation mode', () => {
    const web = { ...free, platform: 'web' }
    for (const id of LATER_ONBOARDING_IDS) expect(canShowFeatureOnboarding(id, web)).toBe(false)
    expect(canShowFeatureOnboarding(ONBOARDING_IDS.ANNOTATION_MODE, web)).toBe(true)
  })
})

describe('withoutTouchDemos', () => {
  it('keeps the text of the annotation mode for a mouse, without its touches', () => {
    const config = getOnboardingConfig(
      ONBOARDING_IDS.ANNOTATION_MODE,
      ((key: string) => key) as never
    )
    const web = withoutTouchDemos(config)
    expect(web?.steps.some(step => step.demo)).toBe(false)
    expect(web?.steps).toHaveLength((config?.steps.length ?? 0) - 1)
  })
})

export type OnboardingSceneId = 'scene-one' | 'scene-two'

export type OnboardingSceneDefinition = {
  id: OnboardingSceneId
  promptKey: string
}

// The complete product storyboard has eight scenes. The playground currently
// wires the first two so the persistent-actor transition can be exercised; the
// remaining definitions can be appended without changing the stage contract.
export const ONBOARDING_SCENE_COUNT = 8

export const ONBOARDING_SCENES: readonly OnboardingSceneDefinition[] = [
  {
    id: 'scene-one',
    promptKey: 'playground.sceneOne.phrase',
  },
  {
    id: 'scene-two',
    promptKey: 'playground.sceneTwo.phrase',
  },
]

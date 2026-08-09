export type OnboardingSceneId =
  | 'scene-one'
  | 'scene-two'
  | 'scene-three'
  | 'scene-four'
  | 'scene-five'
  | 'scene-six'

export type OnboardingSceneDefinition = {
  id: OnboardingSceneId
  promptKey: string
}

// The complete product storyboard has eight scenes. The playground currently
// wires the first six so persistent nodes and interactive scene content can
// be exercised; the remaining definitions can be appended without changing the stage contract.
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
  {
    id: 'scene-three',
    promptKey: 'playground.sceneThree.properPhrase',
  },
  {
    id: 'scene-four',
    promptKey: 'playground.sceneFour.phrase',
  },
  {
    id: 'scene-five',
    promptKey: 'playground.sceneFive.phrase',
  },
  {
    id: 'scene-six',
    promptKey: 'playground.sceneSix.phrase',
  },
]

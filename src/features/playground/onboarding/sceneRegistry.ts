export type OnboardingSceneId =
  | 'scene-one'
  | 'scene-two'
  | 'scene-three'
  | 'scene-four'
  | 'scene-five'
  | 'scene-six'
  | 'scene-seven'

export type OnboardingSceneDefinition = {
  id: OnboardingSceneId
  promptKey: string
}

export const ONBOARDING_SCENE_COUNT = 7

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
  {
    id: 'scene-seven',
    promptKey: 'playground.sceneSeven.phrase',
  },
]

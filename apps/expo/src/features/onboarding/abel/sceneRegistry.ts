export type OnboardingSceneId =
  | 'scene-one'
  | 'scene-two'
  | 'scene-three'
  | 'scene-four'
  | 'scene-strobi'
  | 'scene-five'
  | 'scene-six'
  | 'scene-seven'

export type OnboardingSceneDefinition = {
  id: OnboardingSceneId
  promptKey: string
}

export const ONBOARDING_SCENES: readonly OnboardingSceneDefinition[] = [
  {
    id: 'scene-one',
    promptKey: 'onboarding.abel.sceneOne.phrase',
  },
  {
    id: 'scene-two',
    promptKey: 'onboarding.abel.sceneTwo.phrase',
  },
  {
    id: 'scene-three',
    promptKey: 'onboarding.abel.sceneThree.properPhrase',
  },
  {
    id: 'scene-four',
    promptKey: 'onboarding.abel.sceneFour.phrase',
  },
  {
    id: 'scene-strobi',
    promptKey: 'onboarding.abel.sceneStrobi.phrase',
  },
  {
    id: 'scene-five',
    promptKey: 'onboarding.abel.sceneFive.phrase',
  },
  {
    id: 'scene-six',
    promptKey: 'onboarding.abel.sceneSix.phrase',
  },
  {
    id: 'scene-seven',
    promptKey: 'onboarding.abel.sceneSeven.phrase',
  },
]

/**
 * The scenes this reader sees: the one that presents Strobi only while the study assistant is
 * open to them.
 */
export const onboardingScenes = (showStrobiScene: boolean) =>
  ONBOARDING_SCENES.filter(scene => scene.id !== 'scene-strobi' || showStrobiScene)

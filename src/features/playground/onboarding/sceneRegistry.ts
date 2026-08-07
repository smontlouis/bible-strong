import type { SceneActorLayout } from './OnboardingStage'

export type OnboardingSceneId = 'scene-one' | 'scene-two'
export type OnboardingActorId = 'verse-card'

export type OnboardingSceneDefinition = {
  id: OnboardingSceneId
  promptKey: string
  actorLayouts: Record<OnboardingActorId, SceneActorLayout>
}

// The complete product storyboard has eight scenes. The playground currently
// wires the first two so the persistent-actor transition can be exercised; the
// remaining definitions can be appended without changing the stage contract.
export const ONBOARDING_SCENE_COUNT = 8

export const ONBOARDING_SCENES: readonly OnboardingSceneDefinition[] = [
  {
    id: 'scene-one',
    promptKey: 'playground.sceneOne.phrase',
    actorLayouts: {
      'verse-card': {
        x: -16,
        y: 82,
        width: 382,
        height: 294,
        rotation: -1,
        zIndex: 4,
      },
    },
  },
  {
    id: 'scene-two',
    promptKey: 'playground.sceneTwo.phrase',
    actorLayouts: {
      'verse-card': {
        x: -90,
        y: 221,
        width: 382,
        height: 294,
        scale: 0.5,
        rotation: -2,
        zIndex: 4,
      },
    },
  },
]

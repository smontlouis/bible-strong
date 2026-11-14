import type { AvatarHandle } from '@bible-strong/avatar-react-native'
import { cloneElement, type ReactElement, type Ref } from 'react'
import OnboardingStrobi from './OnboardingStrobi'
import {
  DESIGN_CONTENT_WIDTH,
  DESIGN_STAGE_HEIGHT,
  type OnboardingStageMetrics,
} from './OnboardingStage'
import { Scene } from './SceneGraph'

/** The box Strobi is drawn in, in design points; each scene scales it. */
const STROBI_BOX = 120

/** Where Strobi stands in a scene: its centre and its size, in design points. */
export type StrobiPlacement = { x: number; y: number; size: number }

/** What Strobi does in a scene, where it stands, and where it looks. */
export type StrobiDirection = {
  placement: StrobiPlacement
  /** A state of the catalogue; without one, `clip` plays alone. */
  state?: string
  clip?: string
  /** Where Strobi looks, right and up, each from -1 to 1. */
  lookAt?: readonly [number, number]
  /** Or the centre of what Strobi looks at, in design points. */
  target?: { x: number; y: number }
}

const clamp = (value: number) => Math.max(-1, Math.min(1, value))

/** The gaze towards a point: the whole stage away is as far as the head turns, so it stays a hint. */
export const lookAtTarget = (
  placement: StrobiPlacement,
  target?: { x: number; y: number }
): [number, number] | null =>
  target
    ? [
        clamp((target.x - placement.x) / DESIGN_CONTENT_WIDTH),
        clamp(-(target.y - placement.y) / DESIGN_STAGE_HEIGHT),
      ]
    : null

type StrobiNodeProps = {
  direction: StrobiDirection
  metrics: OnboardingStageMetrics
  strobiRef: Ref<AvatarHandle>
  onPress: () => void
}

/**
 * Strobi as a node of the scene graph. Every scene has one with the same id, so the graph moves
 * and scales it from one scene to the next; its box keeps one size, so the avatar is never
 * redrawn to grow.
 */
export const createStrobiNode = ({ direction, metrics, strobiRef, onPress }: StrobiNodeProps) => {
  const { placement } = direction
  return (
    <Scene.Node
      id="strobi"
      layout="scale"
      frame={{
        x: placement.x - STROBI_BOX / 2,
        y: placement.y - STROBI_BOX / 2,
        width: STROBI_BOX,
        height: STROBI_BOX,
        scale: placement.size / STROBI_BOX,
        zIndex: 30,
      }}
      onPress={onPress}
      pressScale={0.94}
      decorative
    >
      <OnboardingStrobi
        ref={strobiRef}
        state={direction.state}
        clip={direction.clip}
        lookAt={direction.lookAt ?? lookAtTarget(placement, direction.target)}
        size={metrics.s(STROBI_BOX)}
      />
    </Scene.Node>
  )
}

/** A scene with Strobi added among its nodes. */
export const withStrobi = (scene: ReactElement<{ children?: unknown }>, strobi: ReactElement) =>
  cloneElement(scene, undefined, scene.props.children as never, strobi)

import { motionValue, type MotionValue } from 'motion'

import type { AvatarColors } from './avatars'
import { MAX_BODY_NODES } from './body'
import type { AvatarGeometry } from './geometry'

export type RenderedScene = {
  headPath: MotionValue<string>
  backPaths: MotionValue<string>[]
  frontPaths: MotionValue<string>[]
  backNodeIds: { current: (string | null)[] }
  frontNodeIds: { current: (string | null)[] }
  leftPath: MotionValue<string>
  rightPath: MotionValue<string>
  leftOpacity: MotionValue<number>
  rightOpacity: MotionValue<number>
  wirePaths: MotionValue<string>[]
}

export type RenderedColors = {
  body: MotionValue<string>
  eyes: MotionValue<string>
}

const bodyPathSlots = MAX_BODY_NODES + 2

export const createRenderedScene = (geometry: AvatarGeometry): RenderedScene => ({
  headPath: motionValue(geometry.headPath),
  backPaths: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.backPaths[index] ?? '')
  ),
  frontPaths: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.frontPaths[index] ?? '')
  ),
  backNodeIds: { current: geometry.backNodeIds },
  frontNodeIds: { current: geometry.frontNodeIds },
  leftPath: motionValue(geometry.leftPath),
  rightPath: motionValue(geometry.rightPath),
  leftOpacity: motionValue(geometry.leftVisible ? 1 : 0),
  rightOpacity: motionValue(geometry.rightVisible ? 1 : 0),
  wirePaths: geometry.wirePaths.map(path => motionValue(path)),
})

export const createRenderedColors = (colors: AvatarColors): RenderedColors => ({
  body: motionValue(colors.body),
  eyes: motionValue(colors.eyes),
})

export const paintRenderedColors = (rendered: RenderedColors, colors: AvatarColors) => {
  rendered.body.set(colors.body)
  rendered.eyes.set(colors.eyes)
}

export const paintRenderedScene = (scene: RenderedScene, geometry: AvatarGeometry) => {
  scene.headPath.set(geometry.headPath)
  scene.backNodeIds.current = geometry.backNodeIds
  scene.frontNodeIds.current = geometry.frontNodeIds
  scene.backPaths.forEach((path, index) => path.set(geometry.backPaths[index] ?? ''))
  scene.frontPaths.forEach((path, index) => path.set(geometry.frontPaths[index] ?? ''))
  scene.leftPath.set(geometry.leftPath)
  scene.rightPath.set(geometry.rightPath)
  scene.leftOpacity.set(geometry.leftVisible ? 1 : 0)
  scene.rightOpacity.set(geometry.rightVisible ? 1 : 0)
  scene.wirePaths.forEach((path, index) => path.set(geometry.wirePaths[index] ?? ''))
}

export const findBodyNodePath = (scene: RenderedScene, selectedBodyNodeId: 'primary' | string) => {
  if (selectedBodyNodeId === 'primary') return scene.headPath
  const backIndex = scene.backNodeIds.current.indexOf(selectedBodyNodeId)
  if (backIndex >= 0) return scene.backPaths[backIndex]
  const frontIndex = scene.frontNodeIds.current.indexOf(selectedBodyNodeId)
  return frontIndex >= 0 ? scene.frontPaths[frontIndex] : null
}

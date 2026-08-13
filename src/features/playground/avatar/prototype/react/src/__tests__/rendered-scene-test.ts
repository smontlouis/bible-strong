import { createBodyNode } from '../body'
import { renderAvatar, poseFromExpression } from '../geometry'
import { defaultExpression } from '../presets'
import { createRenderedScene, findBodyNodePath, paintRenderedScene } from '../renderedScene'
import { surfacePresets } from '../surfaces'

describe('rendered avatar scene', () => {
  it('keeps layer identity and hit mapping behind the scene seam', () => {
    const node = createBodyNode('sphere', 0)
    const first = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      bodyNodes: [node],
    })
    const scene = createRenderedScene(first)
    const rotated = renderAvatar(
      poseFromExpression({ ...defaultExpression, headY: 35 }),
      surfacePresets.sphere,
      1,
      { bodyNodes: [node] }
    )

    paintRenderedScene(scene, rotated)

    expect(findBodyNodePath(scene, 'primary')).toBe(scene.headPath)
    expect(findBodyNodePath(scene, node.id)).not.toBeNull()
    expect(scene.headPath.get()).toBe(rotated.headPath)
  })
})

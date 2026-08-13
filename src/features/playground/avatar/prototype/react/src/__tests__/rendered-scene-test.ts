import { createBodyNode } from '../body'
import { renderAvatar, poseFromExpression } from '../geometry'
import { defaultExpression } from '../presets'
import {
  createRenderedColors,
  createRenderedScene,
  findBodyNodePath,
  paintRenderedColors,
  paintRenderedScene,
} from '../renderedScene'
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

  it('updates animated colors without replacing their motion values', () => {
    const colors = createRenderedColors({ body: '#5b7fe5', eyes: '#111316' })
    const body = colors.body
    const eyes = colors.eyes

    paintRenderedColors(colors, { body: '#c53b47', eyes: '#ffffff' })

    expect(colors.body).toBe(body)
    expect(colors.eyes).toBe(eyes)
    expect(colors.body.get()).toBe('#c53b47')
    expect(colors.eyes.get()).toBe('#ffffff')
  })
})

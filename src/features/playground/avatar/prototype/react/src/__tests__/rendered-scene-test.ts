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
import defaultStudioDocument from '../defaultStudioDocument.json'
import type { BodyNode } from '../body'
import type { Expression } from '../geometry'
import type { SurfaceConfig } from '../surfaces'

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

  it('keeps Cloudee accessories behind the eyes at expression position 05', () => {
    const avatar = defaultStudioDocument.library.avatars.find(item => item.name === 'Cloudee')!
    const expression = defaultStudioDocument.expressions[5] as Expression

    const geometry = renderAvatar(
      poseFromExpression(expression),
      avatar.body.primary as SurfaceConfig,
      1,
      { bodyNodes: avatar.body.nodes as BodyNode[] }
    )

    expect(geometry.frontNodeIds).toEqual([])

    const clearlyTurned = renderAvatar(
      poseFromExpression({ ...expression, headY: -35 }),
      avatar.body.primary as SurfaceConfig,
      1,
      { bodyNodes: avatar.body.nodes as BodyNode[] }
    )
    expect(clearlyTurned.frontNodeIds).toContain(
      'shape-d4b4e8ad-8625-488d-920c-c497da226f9f'
    )
  })
})

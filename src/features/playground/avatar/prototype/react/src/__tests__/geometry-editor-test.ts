import type { BodyNode } from '../body'
import {
  poseFromExpression,
  renderBodyNodeEditor,
  rotateBodyNodeAroundLocalAxis,
  translateBodyNodeAlongLocalAxis,
} from '../geometry'
import { defaultExpression } from '../presets'
import { surfacePresets } from '../surfaces'

const node: BodyNode = {
  id: 'shape-test',
  name: 'Forme test',
  surface: surfacePresets.cube,
  position: [0, 0, -20],
  rotation: [0, 0, 0],
}

describe('body node editor geometry', () => {
  it('keeps all translation axes manipulable when one points at the camera', () => {
    const editor = renderBodyNodeEditor(poseFromExpression(defaultExpression), node)

    expect(
      Math.hypot(editor.axes.z[0] - editor.center[0], editor.axes.z[1] - editor.center[1])
    ).toBeGreaterThanOrEqual(12)
    expect(Object.values(editor.axes).flat().every(Number.isFinite)).toBe(true)
  })

  it('projects complete local rotation rings around the selected node', () => {
    const editor = renderBodyNodeEditor(poseFromExpression(defaultExpression), {
      ...node,
      rotation: [20, -15, 35],
    })

    expect(editor.rings.x).toHaveLength(65)
    expect(editor.rings.y).toHaveLength(65)
    expect(editor.rings.z).toHaveLength(65)
    expect(editor.rings.z[0]).not.toEqual(editor.rings.z[16])
  })

  it('moves along the rotated local axis', () => {
    const translated = translateBodyNodeAlongLocalAxis({ ...node, rotation: [0, 0, 90] }, 'x', 20)

    expect(translated.position[0]).toBeCloseTo(0)
    expect(translated.position[1]).toBeCloseTo(20)
    expect(translated.position[2]).toBeCloseTo(-20)
  })

  it('composes a local rotation instead of incrementing a raw Euler field', () => {
    const rotated = rotateBodyNodeAroundLocalAxis({ ...node, rotation: [25, 30, -20] }, 'x', 15)

    expect(rotated.rotation.every(Number.isFinite)).toBe(true)
    expect(rotated.rotation).not.toEqual([40, 30, -20])
  })

  it('keeps equivalent Euler values near their current free rotation', () => {
    const rotated = rotateBodyNodeAroundLocalAxis({ ...node, rotation: [0, 0, 350] }, 'x', 1)

    expect(rotated.rotation[2]).toBeGreaterThan(300)
  })
})

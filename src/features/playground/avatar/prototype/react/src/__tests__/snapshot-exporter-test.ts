import { poseFromExpression, renderAvatar } from '../geometry'
import { defaultExpression } from '../presets'
import { createRenderedScene, paintRenderedOffset } from '../renderedScene'
import { serializeAvatarSnapshot, snapshotFileName } from '../snapshotExporter'
import { surfacePresets } from '../surfaces'

describe('avatar snapshot export', () => {
  const geometry = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1)
  const scene = createRenderedScene(geometry)
  const colors = { body: '#5b7fe5', eyes: '#111316' }

  it('exports the currently rendered scene as a transparent SVG', () => {
    paintRenderedOffset(scene, { x: 3, y: -2 })
    const svg = serializeAvatarSnapshot('Strobi', scene, colors, {
      background: 'transparent',
      colorFrom: '#ffffff',
      colorTo: '#000000',
      size: 1024,
    })

    expect(svg).toContain('width="1024" height="1024"')
    expect(svg).toContain('transform="translate(3 -2)"')
    expect(svg).toContain(`d="${geometry.headPath}" fill="#5b7fe5"`)
    expect(svg).toContain('fill="#111316"')
    expect(svg).not.toContain('<rect')
  })

  it('embeds a radial background without external dependencies', () => {
    const svg = serializeAvatarSnapshot('Strobi', scene, colors, {
      background: 'radial',
      colorFrom: '#ffffff',
      colorTo: '#8899aa',
      size: 512,
    })

    expect(svg).toContain('<radialGradient id="snapshot-radial"')
    expect(svg).toContain('fill="url(#snapshot-radial)"')
    expect(snapshotFileName('Étoile du soir')).toBe('etoile-du-soir-snapshot.svg')
    expect(snapshotFileName('Étoile du soir', 'png')).toBe('etoile-du-soir-snapshot.png')
  })
})

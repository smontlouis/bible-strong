// Ground contact along the illustrated desk's left side and sloping front edge.
// These source-image coordinates are visual annotations, independent of collisions.
const dictionaryDeskGround = [
  { x: 246, y: 285 },
  { x: 300, y: 315 },
  { x: 394, y: 293 },
]

export function occlusionDepth(id: string, baseY: number, avatarX: number): number {
  if (id !== 'dictionary-desk' && id !== 'dictionary-reader') return baseY
  const points = dictionaryDeskGround
  const x = Math.max(points[0].x, Math.min(points[points.length - 1].x, avatarX))
  const right = points.findIndex((point, index) => index > 0 && point.x >= x)
  const a = points[right - 1]
  const b = points[right]
  const groundY = a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y)
  // Keep the reader just above its desk, including when viewed from the side.
  return groundY + (id === 'dictionary-reader' ? 0.1 : 0)
}

/** Project a sky layer through the world camera while keeping its own pan/zoom response. */
export function projectCloud(
  x: number,
  y: number,
  camera: { scrollX: number; scrollY: number; width: number; height: number; zoom: number }
) {
  const centerX = camera.scrollX + camera.width / 2
  const centerY = camera.scrollY + camera.height / 2
  const anchorX = 1671 / 2
  const anchorY = 941 / 2
  // A closer foreground layer magnifies both pan and zoom. Its separation
  // from the ground grows continuously as the camera zooms in.
  const scale = 1 + 0.45 * (camera.zoom / 0.8)
  return {
    x: centerX + (x - anchorX - (centerX - anchorX)) * scale,
    y: centerY + (y - anchorY - (centerY - anchorY)) * scale,
    scale,
  }
}

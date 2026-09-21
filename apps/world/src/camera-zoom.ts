export const MAX_CAMERA_ZOOM = 2

/** Both overview and manual zoom use the same viewport-dependent framing. */
export function cameraZoomBounds(
  screenWidth: number,
  screenHeight: number,
  sceneryWidth: number,
  sceneryHeight: number,
  worldHeight: number
) {
  const base = Math.max(1.2, screenHeight / worldHeight)
  const overview = Math.min(screenWidth / sceneryWidth, screenHeight / sceneryHeight) * 0.98
  return { base, overview, minimum: overview / base }
}

export function clampCameraZoom(zoom: number, minimum: number) {
  return Math.min(MAX_CAMERA_ZOOM, Math.max(minimum, zoom))
}

export function zoomFromWheel(currentZoom: number, deltaY: number, minimum: number, deltaMode = 0) {
  const pixelDelta = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1)
  return clampCameraZoom(currentZoom * Math.exp(-pixelDelta * 0.0015), minimum)
}

export function zoomFromPinch(
  startZoom: number,
  startDistance: number,
  currentDistance: number,
  minimum: number
) {
  if (startDistance <= 0 || currentDistance <= 0) return clampCameraZoom(startZoom, minimum)
  return clampCameraZoom(startZoom * (currentDistance / startDistance), minimum)
}

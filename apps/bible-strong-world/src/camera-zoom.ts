export const MIN_CAMERA_ZOOM = 0.6
export const MAX_CAMERA_ZOOM = 2

export function clampCameraZoom(zoom: number) {
  return Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, zoom))
}

export function zoomFromWheel(currentZoom: number, deltaY: number, deltaMode = 0) {
  const pixelDelta = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1)
  return clampCameraZoom(currentZoom * Math.exp(-pixelDelta * 0.0015))
}

export function zoomFromPinch(
  startZoom: number,
  startDistance: number,
  currentDistance: number
) {
  if (startDistance <= 0 || currentDistance <= 0) return clampCameraZoom(startZoom)
  return clampCameraZoom(startZoom * (currentDistance / startDistance))
}

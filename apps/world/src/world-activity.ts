/** Animation visibility is separate from whether the visitor can control the avatar. */
export function canAnimateWorld(stand: boolean, focused: boolean, hidden: boolean): boolean {
  return !hidden && (stand || focused)
}

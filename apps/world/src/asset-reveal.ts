/** A one-time reveal, advancing only while the artwork is visible. */
export class AssetReveal {
  private elapsed = 0
  constructor(private readonly duration = 350) {}

  update(delta: number, visible: boolean, reducedMotion: boolean) {
    if (reducedMotion) this.elapsed = this.duration
    else if (visible && Number.isFinite(delta))
      this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, Math.min(delta, 50)))
    const progress = this.elapsed / this.duration
    return progress * progress * (3 - 2 * progress)
  }
}

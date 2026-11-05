// Chromium < 92 has no Array.prototype.at, and this bundle runs in the device's System WebView.
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value<T>(this: T[], index: number): T | undefined {
      const relative = Math.trunc(index) || 0
      return this[relative < 0 ? this.length + relative : relative]
    },
    configurable: true,
    writable: true,
  })
}

export {}

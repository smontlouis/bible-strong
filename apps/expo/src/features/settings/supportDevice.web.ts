export function getSupportDevice() {
  return {
    os: 'web',
    browser: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
  }
}

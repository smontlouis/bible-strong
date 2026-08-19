export const shouldUseSharedBibleDOM = (platform: string, isInTab?: boolean) =>
  platform === 'android' && Boolean(isInTab)

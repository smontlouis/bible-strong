const PUBLIC_CONTENT_PATTERNS = [
  /^\/bible\//u,
  /^\/strong\/(?:[gh]\d|entity\/)/u,
  /^\/dictionary\/(?:fr|en)\//u,
  /^\/nave\/(?:fr|en)\//u,
  /^\/commentary\/(?:fr|en)\//u,
  /^\/timeline\/(?:fr|en)(?:\/|$)/u,
]

export const isPublicContentPath = (pathname: string): boolean =>
  PUBLIC_CONTENT_PATTERNS.some(pattern => pattern.test(pathname))

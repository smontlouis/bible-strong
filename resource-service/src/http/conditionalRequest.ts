export const resourceEtagMatches = (ifNoneMatch: string | undefined, etag: string): boolean =>
  ifNoneMatch
    ?.split(',')
    .map(candidate => candidate.trim())
    .some(candidate => candidate === '*' || candidate.replace(/^W\//, '') === etag) ?? false

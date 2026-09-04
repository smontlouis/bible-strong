export const localQueryOptions = {
  networkMode: 'always' as const,
}

export const remoteQueryOptions = {
  networkMode: 'online' as const,
}

export const staticResourceQueryOptions = {
  staleTime: Infinity,
}

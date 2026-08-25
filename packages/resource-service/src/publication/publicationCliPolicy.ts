export type CatalogImportMode = 'local' | 'hosted'

const localConnectionString = 'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

const redactDatabaseUrls = (message: string) =>
  message.replace(/postgres(?:ql)?:\/\/\S+/giu, '[REDACTED_DATABASE_URL]')

export const formatPublicationCliFailure = (cause: unknown) => {
  const messages: string[] = []
  const visited = new Set<unknown>()
  let current: unknown = cause

  while (current !== undefined && current !== null && !visited.has(current)) {
    visited.add(current)
    if (current instanceof Error) {
      messages.push(redactDatabaseUrls(current.message))
      current = current.cause
    } else {
      messages.push(redactDatabaseUrls(String(current)))
      break
    }
  }

  return messages.length > 0 ? messages.join('\nCaused by: ') : 'PUBLICATION_CLI_UNKNOWN_FAILURE'
}

export const resolveCatalogImportPolicy = ({
  mode,
  connectionString,
}: {
  mode: CatalogImportMode
  connectionString?: string
}) => {
  if (mode === 'local') {
    return {
      connectionString: connectionString ?? localConnectionString,
      activateForLocalDevelopment: true,
    }
  }

  if (!connectionString) {
    throw new Error('PUBLICATION_HOSTED_DATABASE_URL_REQUIRED')
  }

  let databaseUrl: URL
  try {
    databaseUrl = new URL(connectionString)
  } catch {
    throw new Error('PUBLICATION_HOSTED_DATABASE_URL_INVALID')
  }
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('PUBLICATION_HOSTED_DATABASE_URL_INVALID')
  }
  if (databaseUrl.hostname.includes('-pooler.')) {
    throw new Error('PUBLICATION_HOSTED_DATABASE_URL_MUST_BE_DIRECT')
  }

  return {
    connectionString,
    activateForLocalDevelopment: false,
  }
}

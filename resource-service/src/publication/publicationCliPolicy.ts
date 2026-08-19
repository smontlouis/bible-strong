export type CatalogImportMode = 'local' | 'hosted'

const localConnectionString = 'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

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

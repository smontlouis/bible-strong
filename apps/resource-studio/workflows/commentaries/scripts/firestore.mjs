import { createHash } from 'node:crypto'

const DEFAULT_PROJECT = 'bible-strong-app'

export const sha256 = value => createHash('sha256').update(value).digest('hex')

export const createFirestoreReader = ({
  projectId = DEFAULT_PROJECT,
  fetchImpl = fetch,
  retryCount = 6,
} = {}) => {
  const databaseRoot = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`
  const documentsRoot = `${databaseRoot}/documents`

  const requestJson = async (url, init, attempt = 0) => {
    const response = await fetchImpl(url, init)
    if (response.ok) return response.json()

    if ((response.status === 429 || response.status >= 500) && attempt < retryCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt))
      return requestJson(url, init, attempt + 1)
    }

    throw new Error(`${response.status} ${response.statusText}: ${(await response.text()).slice(0, 500)}`)
  }

  const listDocumentIds = async collection => {
    const ids = []
    let pageToken

    do {
      const url = new URL(`${documentsRoot}/${collection}`)
      url.searchParams.set('pageSize', '1000')
      url.searchParams.set('mask.fieldPaths', 'id')
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      const page = await requestJson(url)
      for (const document of page.documents ?? []) ids.push(document.name.split('/').at(-1))
      pageToken = page.nextPageToken
    } while (pageToken)

    return ids
  }

  const queryCommentaries = async (verseId, codes) => {
    const body = {
      structuredQuery: {
        select: {
          fields: [
            { fieldPath: 'id' },
            { fieldPath: 'content' },
            { fieldPath: 'resource' },
            { fieldPath: 'type' },
            { fieldPath: 'isSDA' },
          ],
        },
        from: [{ collectionId: 'commentaries' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'resource.code' },
            op: 'IN',
            value: { arrayValue: { values: codes.map(stringValue => ({ stringValue })) } },
          },
        },
      },
    }
    const rows = await requestJson(
      `${documentsRoot}/verse-commentaries/${encodeURIComponent(verseId)}:runQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    return rows.flatMap(row => (row.document ? [decodeDocument(row.document)] : []))
  }

  const batchGetFrench = async ids => {
    if (ids.length === 0) return new Map()
    const documents = ids.map(
      id => `${documentsRoot.replace('https://firestore.googleapis.com/v1/', '')}/commentaries-FR/${id}`
    )
    const rows = await requestJson(`${documentsRoot}:batchGet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents, mask: { fieldPaths: ['content'] } }),
    })

    const result = new Map()
    for (const row of rows) {
      if (row.found) {
        result.set(row.found.name.split('/').at(-1), {
          exists: true,
          content: decodeValue(row.found.fields?.content) ?? '',
          createTime: row.found.createTime ?? null,
          updateTime: row.found.updateTime ?? null,
        })
      } else if (row.missing) {
        result.set(row.missing.split('/').at(-1), { exists: false, content: '' })
      }
    }
    return result
  }

  return { batchGetFrench, listDocumentIds, queryCommentaries }
}

export const decodeValue = value => {
  if (!value) return undefined
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('booleanValue' in value) return value.booleanValue
  if ('nullValue' in value) return null
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue)
  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, child]) => [key, decodeValue(child)])
    )
  }
  return undefined
}

export const decodeDocument = document => ({
  documentId: document.name.split('/').at(-1),
  ...Object.fromEntries(
    Object.entries(document.fields ?? {}).map(([key, value]) => [key, decodeValue(value)])
  ),
})

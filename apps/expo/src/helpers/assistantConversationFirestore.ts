import {
  collection,
  deleteDoc,
  doc,
  firebaseDb,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  writeBatch,
} from './firebase'

type Unsubscribe = () => void
type Failure = (error: unknown) => void
type SnapshotItem = { id: string; data: () => unknown }
type BatchDocumentReference = Parameters<ReturnType<typeof writeBatch>['delete']>[0]

export type AssistantConversationDocument = {
  schemaVersion: 1
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  memory?: unknown
}

const clean = (value: unknown): unknown => {
  if (value === undefined) return undefined
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(clean).filter(item => item !== undefined)
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, clean(item)] as const)
      .filter(([, item]) => item !== undefined)
  )
}

const cleanRecord = (value: object) => clean(value) as Record<string, unknown>

const conversationsRef = (account: string) =>
  collection(firebaseDb, 'users', account, 'assistantConversations')

const conversationRef = (account: string, conversationId: string) =>
  doc(firebaseDb, 'users', account, 'assistantConversations', conversationId)

const turnsRef = (account: string, conversationId: string) =>
  collection(firebaseDb, 'users', account, 'assistantConversations', conversationId, 'turns')

export function observeAssistantConversationIndex(
  account: string,
  maximum: number,
  onChange: (documents: { id: string; data: unknown }[]) => void,
  onError: Failure
): Unsubscribe {
  return onSnapshot(
    query(conversationsRef(account), orderBy('updatedAt', 'desc'), limit(maximum)),
    snapshot =>
      onChange(snapshot.docs.map((item: SnapshotItem) => ({ id: item.id, data: item.data() }))),
    onError
  )
}

export function observeAssistantConversation(
  account: string,
  conversationId: string,
  onMetadata: (document: { id: string; data: unknown } | null) => void,
  onTurns: (documents: unknown[]) => void,
  onError: Failure
): Unsubscribe {
  const stopConversation = onSnapshot(
    conversationRef(account, conversationId),
    snapshot => onMetadata(snapshot.exists() ? { id: snapshot.id, data: snapshot.data() } : null),
    onError
  )
  const stopTurns = onSnapshot(
    query(turnsRef(account, conversationId), orderBy('createdAt', 'asc')),
    snapshot => onTurns(snapshot.docs.map((item: SnapshotItem) => item.data())),
    onError
  )
  return () => {
    stopConversation()
    stopTurns()
  }
}

export async function saveAssistantConversationTurn(
  account: string,
  conversationId: string,
  local: AssistantConversationDocument,
  turnId: string,
  turn: object
) {
  const parent = conversationRef(account, conversationId)
  const turnDocument = doc(turnsRef(account, conversationId), turnId)
  await runTransaction(firebaseDb, async transaction => {
    const [parentSnapshot, turnSnapshot] = await Promise.all([
      transaction.get(parent),
      transaction.get(turnDocument),
    ])
    const remote = parentSnapshot.exists()
      ? (parentSnapshot.data() as Partial<AssistantConversationDocument>)
      : null
    if (
      remote &&
      (!Number.isInteger(remote.messageCount) ||
        !Number.isFinite(remote.createdAt) ||
        !Number.isFinite(remote.updatedAt) ||
        typeof remote.title !== 'string')
    )
      throw new Error('CLOUD_HISTORY_INVALID')
    const messageCount = (remote?.messageCount ?? 0) + (turnSnapshot.exists() ? 0 : 2)
    if (messageCount > 300) throw new Error('CLOUD_HISTORY_FULL')
    const remoteIsNewer = (remote?.updatedAt ?? -1) > local.updatedAt
    transaction.set(
      parent,
      cleanRecord({
        schemaVersion: 1,
        title: remoteIsNewer ? remote?.title : local.title,
        createdAt: remote?.createdAt ?? local.createdAt,
        updatedAt: Math.max(remote?.updatedAt ?? -1, local.updatedAt),
        messageCount,
        memory: local.memory,
      }),
      { merge: true }
    )
    transaction.set(turnDocument, cleanRecord(turn))
  })
}

export async function renameAssistantConversation(
  account: string,
  conversationId: string,
  title: string,
  updatedAt: number
) {
  await setDoc(conversationRef(account, conversationId), { title, updatedAt }, { merge: true })
}

export async function deleteAssistantConversation(account: string, conversationId: string) {
  const parent = conversationRef(account, conversationId)
  const turns = await getDocs(turnsRef(account, conversationId))
  if (turns.size === 0) {
    await deleteDoc(parent)
    return
  }
  const batch = writeBatch(firebaseDb)
  turns.docs.forEach((item: { ref: BatchDocumentReference }) => batch.delete(item.ref))
  batch.delete(parent)
  await batch.commit()
}

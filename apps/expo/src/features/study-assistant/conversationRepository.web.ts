import {
  deleteAssistantConversation,
  observeAssistantConversation,
  observeAssistantConversationIndex,
  renameAssistantConversation,
  saveAssistantConversationTurn,
} from '~helpers/assistantConversationFirestore.web'
import {
  conversationMetadata,
  hydrateConversation,
  latestCompletedTurn,
  MAX_CONVERSATIONS,
  parseConversationMetadata,
  parseConversationTurn,
  type Conversation,
  type ConversationMetadata,
} from './conversations'

type Unsubscribe = () => void
type Failure = (error: unknown) => void

export function observeConversationIndex(
  account: string,
  onChange: (conversations: Conversation[]) => void,
  onError: Failure
): Unsubscribe {
  return observeAssistantConversationIndex(
    account,
    MAX_CONVERSATIONS,
    documents => {
      try {
        onChange(
          documents.map(item => {
            const metadata = parseConversationMetadata(item.id, item.data)
            return {
              id: metadata.id,
              title: metadata.title,
              updatedAt: metadata.updatedAt,
              messages: [],
              summaryMessageCount: metadata.messageCount,
              ...(metadata.memory ? { memory: metadata.memory } : {}),
            }
          })
        )
      } catch (error) {
        onError(error)
      }
    },
    onError
  )
}

export function observeConversation(
  account: string,
  conversationId: string,
  onChange: (conversation: Conversation | null) => void,
  onError: Failure
): Unsubscribe {
  let metadata: ConversationMetadata | null = null
  let turns: ReturnType<typeof parseConversationTurn>[] | null = null
  const emit = () => {
    if (!metadata || !turns || turns.length * 2 !== metadata.messageCount) return
    try {
      onChange(hydrateConversation(metadata, turns))
    } catch (error) {
      onError(error)
    }
  }
  return observeAssistantConversation(
    account,
    conversationId,
    document => {
      if (!document) {
        onChange(null)
        return
      }
      try {
        metadata = parseConversationMetadata(document.id, document.data)
        emit()
      } catch (error) {
        onError(error)
      }
    },
    documents => {
      try {
        turns = documents.map(parseConversationTurn)
        emit()
      } catch (error) {
        onError(error)
      }
    },
    onError
  )
}

export async function saveConversation(account: string, conversation: Conversation) {
  const turn = latestCompletedTurn(conversation)
  if (!turn) return
  const metadata = conversationMetadata(conversation)
  await saveAssistantConversationTurn(
    account,
    conversation.id,
    {
      schemaVersion: 1,
      title: metadata.title,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      messageCount: metadata.messageCount,
      memory: metadata.memory,
    },
    turn.user.id,
    turn
  )
}

export const renameConversation = renameAssistantConversation
export const deleteConversation = deleteAssistantConversation

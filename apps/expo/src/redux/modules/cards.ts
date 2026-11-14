import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { importData, receiveLiveUpdates, USER_LOGOUT } from './user'

// The collectible cards a reader has collected (ADR-0090): card identity → when it was collected.
// The collection only grows; it is synced as the `cards` field of the user document, one entry
// per write, so two installs that collect at the same time keep both.

export type CollectedCards = Record<string, number>

type CardsState = {
  collected: CollectedCards
}

const initialState: CardsState = {
  collected: {},
}

/** The well-formed entries of a collection read from the account, a backup or a guest. */
export const parseCollectedCards = (value: unknown): CollectedCards | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1]) && !!entry[0]
    )
  )
}

/** Both collections, each card at the first time it was collected. */
export const mergeCollectedCards = (current: CollectedCards, added: CollectedCards) => {
  const merged = { ...current }
  Object.entries(added).forEach(([id, collectedAt]) => {
    if (merged[id] === undefined || collectedAt < merged[id]) merged[id] = collectedAt
  })
  return merged
}

const cardsSlice = createSlice({
  name: 'cards',
  initialState,
  reducers: {
    collectCard(state, action: PayloadAction<{ id: string; collectedAt: number }>) {
      const { id, collectedAt } = action.payload
      if (state.collected[id] === undefined) state.collected[id] = collectedAt
    },
  },
  extraReducers: builder => {
    // The account's collection is authoritative, as the plans: Firestore's snapshots already
    // carry the writes of this device that have not reached the server.
    builder.addCase(receiveLiveUpdates, (state, action) => {
      const remote = parseCollectedCards(action.payload.remoteUserData.cards)
      if (remote) state.collected = remote
    })
    builder.addCase(importData, (state, action) => {
      const imported = parseCollectedCards(action.payload.cards)
      if (imported) state.collected = mergeCollectedCards(state.collected, imported)
    })
    builder.addCase(USER_LOGOUT, state => {
      state.collected = initialState.collected
    })
  },
})

export const { collectCard } = cardsSlice.actions

export default cardsSlice.reducer

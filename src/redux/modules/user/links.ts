import { createAction } from '@reduxjs/toolkit'
import { VerseIds } from '~common/types'
import orderVerses from '~helpers/orderVerses'
import { Link } from '../user'

// Action type constants for backward compatibility
export const ADD_LINK = 'user/ADD_LINK'
export const UPDATE_LINK = 'user/UPDATE_LINK'
export const REMOVE_LINK = 'user/REMOVE_LINK'

// RTK Action Creators
export const addLinkAction = createAction(ADD_LINK, (linkData: { [key: string]: Link }) => ({
  payload: linkData,
}))

export const updateLink = createAction(UPDATE_LINK, (key: string, data: Partial<Link>) => ({
  payload: { key, data },
}))

export const deleteLink = createAction(REMOVE_LINK, (linkId: string) => ({
  payload: linkId,
}))

// Alias for consistency with removeNote, removeHighlight pattern
export const removeLink = deleteLink

// Helper function that creates the link with proper key
export function addLink(link: Link, selectedVerses: VerseIds) {
  selectedVerses = orderVerses(selectedVerses)
  const key = Object.keys(selectedVerses).join('/')

  if (!key) {
    return
  }
  return addLinkAction({ [key]: link })
}

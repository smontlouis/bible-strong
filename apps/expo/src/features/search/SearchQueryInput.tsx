import { useEffect, useEffectEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RefObject } from 'react'
import { Keyboard, type TextInput } from 'react-native'
import SearchInput from '~common/SearchInput'

type Props = {
  query: string
  initialDraft?: string
  draftKey?: object
  inputRef: RefObject<TextInput | null>
  onSubmit: (query: string) => void
  onSaveDraft?: (draft: string) => void
}

// Survives a tab view unmount without writing into a removed splitAtom on cleanup.
// No tab subscriber is notified on keystrokes; blur persists the draft to storage.
const drafts = new WeakMap<object, { query: string; draft: string }>()

export const SEARCH_INPUT_DEBOUNCE_MS = 800

/** Keep keystrokes local; publish only after the reader pauses typing. */
export default function SearchQueryInput({
  query,
  initialDraft,
  draftKey,
  inputRef,
  onSubmit,
  onSaveDraft,
}: Props) {
  const { t } = useTranslation()
  const [input, setInput] = useState(() => {
    const saved = draftKey ? drafts.get(draftKey) : undefined
    return { query, draft: saved?.query === query ? saved.draft : (initialDraft ?? query) }
  })
  if (input.query !== query) setInput({ query, draft: query })
  const draft = input.query === query ? input.draft : query
  useEffect(() => {
    if (draftKey && drafts.get(draftKey)?.query !== query) drafts.delete(draftKey)
  }, [draftKey, query])

  const publishDraft = useEffectEvent(() => {
    const value = draft.trim()
    const next = { query: value, draft }
    // Acknowledging our own search must preserve spaces already typed for the next word.
    if (draftKey) drafts.set(draftKey, next)
    setInput(next)
    onSubmit(value)
  })
  useEffect(() => {
    if (draft.trim() === query.trim()) return
    const timeout = setTimeout(() => publishDraft(), SEARCH_INPUT_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [draft, query])

  const submit = () => {
    const value = draft.trim()
    if (draftKey) drafts.delete(draftKey)
    setInput({ query: value, draft: value })
    onSubmit(value)
    inputRef.current?.blur()
    Keyboard.dismiss()
  }

  return (
    <SearchInput
      inputRef={inputRef}
      placeholder={t('search.placeholder')}
      value={draft}
      onChangeText={value => {
        const next = { query, draft: value }
        if (draftKey) drafts.set(draftKey, next)
        setInput(next)
      }}
      onDelete={() => {
        if (draftKey) drafts.delete(draftKey)
        setInput({ query: '', draft: '' })
        onSubmit('')
      }}
      onBlur={() => onSaveDraft?.(draft)}
      returnKeyType="search"
      onSubmitEditing={submit}
    />
  )
}

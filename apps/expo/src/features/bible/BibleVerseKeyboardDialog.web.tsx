import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import { webThemeVariables } from '~themes/webThemeVariables'
import { webFontFamily } from '~helpers/webFontFamily'
import { getChapterVerseCountFromCoverage } from '~helpers/bibleCoverage'
import { useTabCommands } from '~common/useTabCommands'
import { useBibleKeyboardShortcut } from './useBibleKeyboardShortcut'
import { parseVerseDestination } from './bibleKeyboardActions'
import type { BibleVerseKeyboardDialogProps } from './BibleVerseKeyboardDialog'
import './bible-keyboard.css'

export default function BibleVerseKeyboardDialog({
  bibleAtom,
  coverage,
  onNavigate,
}: BibleVerseKeyboardDialogProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const bible = useAtomValue(bibleAtom)
  const { selectedBook: book, selectedChapter: chapter, selectedVersion: version } = bible.data
  const count = getChapterVerseCountFromCoverage(coverage, book.Numero, chapter)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const present = () => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery('')
    setOpen(true)
  }
  const active = useBibleKeyboardShortcut('v', bible.id, present, !!count)
  useTabCommands(
    [{ id: 'go-to-verse', title: t('goToVerse'), attributes: { disabled: !count } }],
    present
  )
  useEffect(() => {
    setOpen(false)
  }, [active, book.Numero, chapter, version])
  const destination = parseVerseDestination(query, count)
  return (
    <Dialog.Root open={open && active} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="bs-command-overlay" />
        <Dialog.Content
          className="bs-command-dialog bs-verse-jump"
          style={{
            ...webThemeVariables(theme.colors),
            fontFamily: webFontFamily(theme.fontFamily.text),
          }}
          onOpenAutoFocus={event => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
          onCloseAutoFocus={event => {
            event.preventDefault()
            if (returnFocus.current?.isConnected) returnFocus.current.focus()
          }}
        >
          <Dialog.Title>{t('goToVerse')}</Dialog.Title>
          <Dialog.Description>
            {book.Nom} {chapter} · {t('hotkeys.verseRange', { max: count })}
          </Dialog.Description>
          <form
            onSubmit={event => {
              event.preventDefault()
              if (destination === undefined) return
              onNavigate(destination)
              setOpen(false)
            }}
          >
            <input
              ref={inputRef}
              inputMode="numeric"
              autoComplete="off"
              value={query}
              aria-label={t('Verset')}
              aria-invalid={!!query && destination === undefined}
              onChange={event => setQuery(event.target.value)}
              placeholder="18"
            />
            <button type="submit" disabled={destination === undefined}>
              {t('hotkeys.goToVerse')}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

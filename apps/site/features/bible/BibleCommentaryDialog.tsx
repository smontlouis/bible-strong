import { useEffect, useRef, useState, type RefObject } from 'react'
import { useI18n } from '@/locales'
import {
  loadCommentarySection,
  type CommentarySectionData,
} from '../commentary/commentary.functions'
import type { ResourceLanguage } from '../resources/publicSite'
import { bibleBookSlug } from './bibleBooks'

type DialogState = {
  key: string
  /** The commentary and the verses, as the comment is labelled in the text. */
  source: string
  /** The address of the section, which the comment links to without scripting. */
  path: string
  status: 'loading' | 'ready' | 'error'
  section?: CommentarySectionData
}

// One request per section for the life of the page.
const sections = new Map<string, Promise<CommentarySectionData>>()

/**
 * The comment opened from the text. A comment shown in the text is a plain link to its
 * section in the commentary; where the browser has dialogs, a click reads the whole comment
 * over the passage instead of leaving it.
 */
export default function BibleCommentaryDialog({
  containerRef,
  language,
  book,
  chapter,
}: {
  /** The element whose `a[data-commentary]` links open the dialog. */
  containerRef: RefObject<HTMLElement | null>
  language: ResourceLanguage
  book: number
  chapter: number
}) {
  const t = useI18n()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [state, setState] = useState<DialogState>()

  useEffect(() => {
    const container = containerRef.current
    const dialog = dialogRef.current
    const bookSlug = bibleBookSlug(book)
    if (!container || !dialog || !bookSlug || typeof dialog.showModal !== 'function') return

    const onClick = (event: MouseEvent) => {
      const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      if (event.defaultPrevented || event.button !== 0 || modified) return
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-commentary]')
      const { commentary, section } = link?.dataset ?? {}
      if (!link || !commentary || !section) return
      event.preventDefault()

      const key = `${language}:${commentary}:${bookSlug}:${chapter}:${section}`
      const opened = {
        key,
        source: link.querySelector('.bible-comment__source')?.textContent ?? '',
        path: link.getAttribute('href') ?? '',
      }
      setState({ ...opened, status: 'loading' })
      if (!dialog.open) dialog.showModal()

      let request = sections.get(key)
      if (!request) {
        request = loadCommentarySection({
          data: {
            language,
            resource: commentary,
            book: bookSlug,
            chapter: String(chapter),
            section,
          },
        })
        sections.set(key, request)
        request.catch(() => sections.delete(key))
      }
      request.then(
        loaded =>
          setState(current =>
            current?.key === key ? { ...opened, status: 'ready', section: loaded } : current
          ),
        () => setState(current => (current?.key === key ? { ...opened, status: 'error' } : current))
      )
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [containerRef, language, book, chapter])

  return (
    <dialog
      ref={dialogRef}
      className="bible-comment-dialog"
      aria-labelledby="bible-comment-dialog-title"
      // A click on the backdrop lands on the dialog itself, outside its content.
      onClick={event => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      {state && (
        <div className="bible-comment-dialog__content">
          <header className="bible-comment-dialog__header">
            <p id="bible-comment-dialog-title" className="font-semibold">
              {state.source}
            </p>
            <form method="dialog">
              <button
                type="submit"
                className="bible-comment-dialog__close"
                aria-label={t('bible.comment.close')}
              >
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
                  <path
                    d="m4 4 8 8m0-8-8 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </form>
          </header>

          {state.status === 'loading' && (
            <p className="resource-muted text-sm">{t('bible.comment.loading')}</p>
          )}
          {state.status === 'error' && <p className="text-sm">{t('bible.comment.error')}</p>}
          {state.section && (
            <div
              className="commentary-section resource-prose"
              dangerouslySetInnerHTML={{ __html: state.section.html }}
            />
          )}

          <p className="mt-5">
            <a
              className="resource-link text-sm font-semibold"
              href={state.section?.path ?? state.path}
            >
              {t('bible.comment.open')}
            </a>
          </p>
        </div>
      )}
    </dialog>
  )
}

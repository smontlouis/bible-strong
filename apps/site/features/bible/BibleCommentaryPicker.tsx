import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useI18n } from '@/locales'
import type { BiblePageData } from './bible.functions'
import { MAX_INLINE_COMMENTARIES, serializeInlineCommentaries } from './bibleCommentaries'
import { buildBiblePath } from './bibleRoutes'

/**
 * The commentaries a reader shows in the text. The boxes belong to a form that names them in
 * the address of the page, so the choice works before hydration; with scripting, a box
 * applies at once and the reader keeps their place.
 */
export default function BibleCommentaryPicker({
  page,
  onChange,
}: {
  page: BiblePageData
  /** Called before the text changes, while the place of the reader can still be read. */
  onChange?: () => void
}) {
  const t = useI18n()
  const navigate = useNavigate()
  const { versionId, presentation, book, chapter, passage, gloss } = page
  const shown = page.inlineCommentaries.map(commentary => commentary.id)
  const shownKey = shown.join('.')
  // What the reader has just asked for, until the page that shows it has loaded.
  const [asked, setAsked] = useState<string[]>()
  useEffect(() => setAsked(undefined), [shownKey])
  const checked = asked ?? shown

  const commenting = new Set(page.commentaries.map(commentary => commentary.id))
  const choices = [
    ...page.commentaries.map(({ id, title }) => ({ id, title, silent: false })),
    // A commentary the reader shows stays in the list where it says nothing, to be unchecked.
    ...page.inlineCommentaries
      .filter(commentary => !commenting.has(commentary.id))
      .map(({ id, title }) => ({ id, title, silent: true })),
  ]
  const full = checked.length >= MAX_INLINE_COMMENTARIES

  const toggle = (id: string, on: boolean) => {
    const next = on
      ? [...checked.filter(other => other !== id), id]
      : checked.filter(other => other !== id)
    setAsked(next)
    onChange?.()
    void navigate({
      to: '.',
      search: { commentary: serializeInlineCommentaries([...next].sort()) },
      resetScroll: false,
    })
  }

  return (
    <details name="bible-nav" className="bible-nav__comments">
      <summary
        className="bible-nav__trigger"
        // The name of the control begins with what it shows: its label and the number checked.
        aria-label={`${t('bible.nav.commentaries')}${checked.length ? ` ${checked.length}` : ''} – ${t('bible.nav.commentaries.title')}`}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0">
          <path
            d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        <span className="bible-nav__comments-label">{t('bible.nav.commentaries')}</span>
        {checked.length > 0 && <span className="bible-nav__badge">{checked.length}</span>}
      </summary>
      <div className="bible-nav__panel">
        <form
          method="get"
          action={buildBiblePath({ versionId, presentation, book, chapter, passage, gloss })}
        >
          <p className="bible-nav__title">{t('bible.nav.commentaries.title')}</p>
          <ul className="bible-nav__list bible-nav__list--wide">
            {choices.map(choice => {
              const on = checked.includes(choice.id)
              return (
                <li key={choice.id}>
                  <label className="bible-nav__item bible-nav__check">
                    <input
                      type="checkbox"
                      name="commentary"
                      value={choice.id}
                      checked={on}
                      disabled={!on && full}
                      onChange={event => toggle(choice.id, event.target.checked)}
                    />
                    <span className="min-w-0 truncate">{choice.title}</span>
                    {choice.silent && (
                      <span className="resource-muted shrink-0 text-xs">
                        {t('bible.nav.commentaries.silent')}
                      </span>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
          <p className="resource-muted mt-3 text-xs">
            {t('bible.nav.commentaries.hint').replace('{count}', String(MAX_INLINE_COMMENTARIES))}
          </p>
          <noscript>
            <button type="submit" className="resource-cta mt-3">
              {t('bible.nav.commentaries.apply')}
            </button>
          </noscript>
        </form>
      </div>
    </details>
  )
}

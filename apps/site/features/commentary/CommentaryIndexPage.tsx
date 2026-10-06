import ResourceShell from '../resources/ResourceShell'
import { resourceSection } from '../resources/sections'
import type { CommentaryIndexPageData } from './commentary.functions'
import {
  buildCommentaryIndexPath,
  buildCommentaryPath,
  otherResourceLanguage,
  WEB_APP_COMMENTARIES_URL,
} from './commentaryRoutes'
import { commentaryMessages } from './messages'

/** `/commentary/:language` — the commentaries published in a language. */
export default function CommentaryIndexPage({ page }: { page: CommentaryIndexPageData }) {
  const { language, commentaries } = page
  const t = commentaryMessages(language)

  return (
    <ResourceShell
      alternatePath={buildCommentaryIndexPath(otherResourceLanguage(language))}
      appUrl={WEB_APP_COMMENTARIES_URL}
      section="commentary"
    >
      <article lang={language}>
        <header>
          <p className="resource-muted text-sm font-medium uppercase tracking-[0.14em]">
            {resourceSection('commentary').label[language]}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
            {t('commentary.index.title')}
          </h1>
          <p className="resource-prose mt-5">{t('commentary.index.intro')}</p>
          <p className="resource-muted mt-3 text-sm">
            {t('commentary.index.count', { count: commentaries.length })}
          </p>
        </header>

        <ul className="mt-10 grid gap-4">
          {commentaries.map(commentary => (
            <li key={commentary.id} className="resource-card px-5 py-4">
              <h2 className="text-xl font-semibold">
                <a className="resource-link" href={buildCommentaryPath(language, commentary.id)}>
                  {commentary.title}
                </a>
              </h2>
              <p className="resource-muted mt-1 text-sm">{commentary.author}</p>
              {commentary.description && <p className="mt-3">{commentary.description}</p>}
              <p className="resource-muted mt-3 text-xs">{commentary.rights}</p>
            </li>
          ))}
        </ul>
      </article>
    </ResourceShell>
  )
}

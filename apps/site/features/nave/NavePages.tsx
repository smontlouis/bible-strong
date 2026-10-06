import LetterNav from '../resources/LetterNav'
import Pagination from '../resources/Pagination'
import ResourceShell from '../resources/ResourceShell'
import { NAVE_MESSAGES, naveCount } from './messages'
import type { NaveIndexPageData, NaveLetterPageData } from './nave.functions'
import { naveLetterBreadcrumbs } from './naveHead'
import {
  buildNaveIndexPath,
  buildNaveLetterPath,
  buildNavePath,
  NAVE_LETTERS,
  WEB_APP_NAVE_URL,
} from './naveRoutes'

/** `/nave/:language` — the topics of a publication, filed by letter. */
export function NaveIndexPage({ page }: { page: NaveIndexPageData }) {
  const { language } = page
  const messages = NAVE_MESSAGES[language]
  return (
    <ResourceShell
      alternatePath={
        page.hasAlternate ? buildNaveIndexPath(language === 'fr' ? 'en' : 'fr') : undefined
      }
      appUrl={WEB_APP_NAVE_URL}
      section="nave"
    >
      <article>
        <header>
          <p className="resource-muted text-sm font-medium uppercase tracking-[0.14em]">
            {messages.name}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
            {messages['index.title']}
          </h1>
          <p className="resource-prose mt-5">
            {messages['index.intro'].replace('{count}', page.topicCount.toLocaleString(language))}
          </p>
          {messages.notice && <p className="resource-muted mt-4 text-sm">{messages.notice}</p>}
        </header>
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">{messages['index.letters']}</h2>
          <LetterNav
            letters={NAVE_LETTERS}
            available={page.letters}
            hrefFor={letter => buildNaveLetterPath(language, letter)}
            label={messages['index.letters']}
          />
        </section>
      </article>
    </ResourceShell>
  )
}

/** `/nave/:language/index/:letter[/:page]` — the topics filed under one letter. */
export function NaveLetterPage({ page }: { page: NaveLetterPageData }) {
  const { language, letter, topics } = page
  const messages = NAVE_MESSAGES[language]
  const first = topics[0]
  const last = topics[topics.length - 1]
  return (
    <ResourceShell
      alternatePath={buildNaveIndexPath(language === 'fr' ? 'en' : 'fr')}
      appUrl={WEB_APP_NAVE_URL}
      section="nave"
      breadcrumbs={naveLetterBreadcrumbs(language, letter, page.page)}
    >
      <article>
        <header>
          <h1 className="font-serif text-4xl leading-tight md:text-5xl">
            {messages['letter.title'].replace('{letter}', letter.toUpperCase())}
          </h1>
          <p className="resource-muted mt-3 text-sm">
            {naveCount(language, 'letter.count', page.topicCount)}
            {page.pageCount > 1 && first && last && (
              <>
                {' · '}
                {messages['letter.pageOf']
                  .replace('{page}', String(page.page))
                  .replace('{count}', String(page.pageCount))}
                {' · '}
                {messages['letter.range']
                  .replace('{first}', () => first.name)
                  .replace('{last}', () => last.name)}
              </>
            )}
          </p>
        </header>

        <div className="mt-8">
          <LetterNav
            letters={NAVE_LETTERS}
            available={page.letters}
            current={letter}
            hrefFor={target => buildNaveLetterPath(language, target)}
            label={messages['index.letters']}
          />
        </div>

        <ul className="strong-list mt-8">
          {topics.map(topic => (
            <li key={topic.normalizedName}>
              <a
                className="strong-list__entry"
                href={buildNavePath(language, topic.normalizedName)}
              >
                <span className="nave-list__name">{topic.name}</span>
                {topic.original && (
                  <span className="nave-list__original" lang="en">
                    {topic.original}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>

        <Pagination
          current={page.page}
          pageCount={page.pageCount}
          hrefFor={target => buildNaveLetterPath(language, letter, target)}
        />
      </article>
    </ResourceShell>
  )
}

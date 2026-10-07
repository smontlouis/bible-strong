import ResourceShell from '../resources/ResourceShell'
import { NAVE_MESSAGES, naveCount } from './messages'
import type { NaveTopicPageData } from './nave.functions'
import { naveTopicBreadcrumbs } from './naveHead'
import { buildNaveIndexPath, buildNavePath, buildWebAppNaveUrl } from './naveRoutes'

/** `/nave/:language/:topic` — a topic: its sub-topics and the passages they cite. */
export default function NaveTopicPage({ topic }: { topic: NaveTopicPageData }) {
  const { language, normalizedName, previous, next } = topic
  const messages = NAVE_MESSAGES[language]
  const alternateLanguage = language === 'fr' ? 'en' : 'fr'

  return (
    <ResourceShell
      alternatePath={
        topic.hasAlternate
          ? buildNavePath(alternateLanguage, normalizedName)
          : buildNaveIndexPath(alternateLanguage)
      }
      appUrl={buildWebAppNaveUrl(language, normalizedName)}
      section="nave"
      breadcrumbs={naveTopicBreadcrumbs(topic)}
    >
      <article>
        <header>
          <p className="resource-muted text-sm font-medium uppercase tracking-[0.14em]">
            {messages.name}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">{topic.name}</h1>
          {topic.original && (
            <p className="resource-muted mt-3 text-sm">
              {messages['topic.original']}
              {messages.separator}
              <span lang="en">{topic.original}</span>
            </p>
          )}
          {topic.referenceCount > 0 && (
            <p className="resource-chip mt-5">
              {naveCount(language, 'topic.references', topic.referenceCount)}
            </p>
          )}
          {messages.notice && <p className="resource-muted mt-4 text-sm">{messages.notice}</p>}
        </header>

        <section className="mt-10">
          <h2 className="mb-5 text-xl font-semibold">
            {messages[topic.referenceCount > 0 ? 'topic.outline' : 'topic.seeAlso']}
          </h2>
          <div
            className="resource-prose nave-outline"
            dangerouslySetInnerHTML={{ __html: topic.html }}
          />
        </section>

        {(previous || next) && (
          <nav
            className="mt-12 flex justify-between gap-4"
            aria-label={messages['topic.neighbours']}
          >
            {previous ? (
              <a
                className="resource-link py-1"
                href={buildNavePath(language, previous.normalizedName)}
                rel="prev"
              >
                ← {previous.name}
              </a>
            ) : (
              <span />
            )}
            {next && (
              <a
                className="resource-link py-1 text-end"
                href={buildNavePath(language, next.normalizedName)}
                rel="next"
              >
                {next.name} →
              </a>
            )}
          </nav>
        )}
      </article>
    </ResourceShell>
  )
}

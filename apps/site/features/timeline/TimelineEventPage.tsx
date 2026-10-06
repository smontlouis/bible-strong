import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { bibleVersionName, findBibleVersion } from '../bible/bibleVersions'
import ResourceShell from '../resources/ResourceShell'
import { TIMELINE_MESSAGES } from './messages'
import type {
  TimelineEventLink,
  TimelineEventPageData,
  TimelinePagePassage,
} from './timeline.functions'
import { formatTimelineDates } from './timelineDates'
import TimelineEventList from './TimelineEventList'
import { findTimelinePeriod } from './timelinePeriods'
import {
  buildTimelineEventPath,
  buildTimelineEventPlacePath,
  buildTimelinePeriodPath,
  buildWebAppTimelineUrl,
  timelineEventBreadcrumbs,
} from './timelineRoutes'

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mt-12">
    <h2 className="mb-4 text-xl font-semibold">{title}</h2>
    {children}
  </section>
)

/**
 * An image of the publication. Its size is not published, so it is fitted into a frame of
 * fixed proportions and the text never moves when it arrives.
 */
const Figure = ({
  image,
  alt,
  captionLang,
  lazy,
}: {
  image: TimelineEventPageData['images'][number]
  alt: string
  captionLang: string | undefined
  lazy?: boolean
}) => (
  <figure className="timeline-figure">
    <div className="timeline-figure__frame">
      <img
        src={image.src}
        alt={alt}
        width={720}
        height={480}
        loading={lazy ? 'lazy' : undefined}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </div>
    {image.caption && <figcaption lang={captionLang}>{image.caption}</figcaption>}
  </figure>
)

const Passage = ({ passage }: { passage: TimelinePagePassage }) => (
  <li>
    {passage.path ? (
      <a
        className="resource-link inline-flex min-h-6 items-center text-sm font-semibold"
        href={passage.path}
      >
        {passage.label}
      </a>
    ) : (
      <span className="text-sm font-semibold">{passage.label}</span>
    )}
    {passage.verses.length > 0 && (
      <blockquote className="resource-prose">
        {passage.verses.map(verse => (
          <Fragment key={verse.number}>
            {passage.verses.length > 1 && (
              <span className="timeline-verse-number">{verse.number}</span>
            )}
            {` ${verse.text} `}
          </Fragment>
        ))}
        {passage.truncated && '…'}
      </blockquote>
    )}
  </li>
)

const Neighbour = ({
  event,
  label,
  rel,
  language,
}: {
  event: TimelineEventLink
  label: string
  rel: 'prev' | 'next'
  language: TimelineEventPageData['language']
}) => (
  <a
    className={`resource-card timeline-neighbour timeline-neighbour--${rel}`}
    href={buildTimelineEventPath(language, event.slug)}
    rel={rel}
  >
    <span className="resource-muted text-sm">{rel === 'prev' ? `← ${label}` : `${label} →`}</span>{' '}
    <span className="font-semibold">{event.title}</span>{' '}
    <span className="resource-muted text-sm">{formatTimelineDates(event.dates, language)}</span>
  </a>
)

/** `/timeline/:language/:slug` — an event of the timeline. */
export default function TimelineEventPage({ event }: { event: TimelineEventPageData }) {
  const { language, slug } = event
  const messages = TIMELINE_MESSAGES[language]
  const period = findTimelinePeriod(event.period)
  const bibleVersion = findBibleVersion(event.bibleVersionId)
  const [mainImage, ...otherImages] = event.images
  // Captions are only published in English.
  const captionLang = language === 'en' ? undefined : 'en'

  return (
    <ResourceShell
      section="timeline"
      breadcrumbs={timelineEventBreadcrumbs(language, event.title)}
      alternatePath={
        event.translated ? buildTimelineEventPath(language === 'fr' ? 'en' : 'fr', slug) : undefined
      }
      appUrl={buildWebAppTimelineUrl(language, slug)}
    >
      <article>
        <header>
          {period && (
            <a
              className="resource-chip"
              href={buildTimelinePeriodPath(language, period.id)}
              style={{ '--timeline-period': period.color } as CSSProperties}
            >
              <span className="timeline-marker self-center" aria-hidden="true" />
              {period.title[language]}
            </a>
          )}
          <h1 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">{event.title}</h1>
          <dl className="mt-3">
            <dt className="sr-only">{messages.dates}</dt>
            <dd className="text-xl font-medium">{formatTimelineDates(event.dates, language)}</dd>
          </dl>
          <a
            className="resource-link mt-3 inline-block text-sm font-semibold"
            href={buildTimelineEventPlacePath(language, slug)}
          >
            {messages.locate}
          </a>
        </header>

        {event.summary && <p className="resource-prose timeline-lead mt-6">{event.summary}</p>}

        {mainImage && (
          <div className="mt-8">
            <Figure image={mainImage} alt={event.title} captionLang={captionLang} />
          </div>
        )}

        {event.paragraphs.length > 0 && (
          <Section title={messages.article}>
            <div className="resource-prose timeline-article">
              {event.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </Section>
        )}

        {event.passages.length > 0 && (
          <Section title={messages.passages}>
            <ul className="space-y-5">
              {event.passages.map((passage, index) => (
                <Passage key={index} passage={passage} />
              ))}
            </ul>
            {bibleVersion && event.passages.some(passage => passage.verses.length > 0) && (
              <p className="resource-muted mt-5 text-sm">
                {messages.passagesVersion.replace(
                  '{version}',
                  bibleVersionName(bibleVersion, language)
                )}
              </p>
            )}
          </Section>
        )}

        {otherImages.length > 0 && (
          <Section title={messages.images}>
            <div className="grid gap-5 sm:grid-cols-2">
              {otherImages.map(image => (
                <Figure
                  key={image.src}
                  image={image}
                  alt={event.title}
                  captionLang={captionLang}
                  lazy
                />
              ))}
            </div>
          </Section>
        )}

        {event.related.length > 0 && (
          <Section title={messages.related}>
            <TimelineEventList events={event.related} language={language} />
          </Section>
        )}

        {(event.previous || event.next) && (
          <nav className="timeline-neighbours mt-14" aria-label={messages.neighbours}>
            {event.previous && (
              <Neighbour
                event={event.previous}
                label={messages.previous}
                rel="prev"
                language={language}
              />
            )}
            {event.next && (
              <Neighbour event={event.next} label={messages.next} rel="next" language={language} />
            )}
          </nav>
        )}
      </article>
    </ResourceShell>
  )
}

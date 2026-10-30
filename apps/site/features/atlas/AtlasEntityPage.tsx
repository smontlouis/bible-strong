import SiteLink from '@/components/SiteLink'
import { useState } from 'react'
import ResourceShell from '../resources/ResourceShell'
import type { AtlasEntityPageData } from './atlas.functions'
import AtlasCards from './AtlasCards'
import AtlasMap from './AtlasMap'
import { AtlasPicture, AtlasStrip, AtlasTileLink } from './AtlasParts'
import {
  buildAtlasCardPath,
  buildAtlasEntityPath,
  buildAtlasFamilyPath,
  buildAtlasPath,
  buildWebAppEntityUrl,
} from './atlasRoutes'
import { ATLAS_MESSAGES, countLabel } from './messages'

/** How many chapters of a book are shown before the rest folds away. */
const CHAPTERS_SHOWN = 24

/**
 * `/atlas/:language/:uniqueName` — one entity: its portrait and stages, who or what it is, its
 * relations, its place on the map and every chapter that names it.
 */
export default function AtlasEntityPage({ page }: { page: AtlasEntityPageData }) {
  const { language } = page
  const messages = ATLAS_MESSAGES[language]
  const [stageKey, setStageKey] = useState<string>()
  const stage = page.stages.find(item => item.key === stageKey)
  const picture = stage?.picture ?? page.picture
  const subtitle = stage?.label ?? page.title
  const isPlace = page.family === 'places'

  return (
    <ResourceShell
      section="atlas"
      alternatePath={buildAtlasEntityPath(language === 'fr' ? 'en' : 'fr', page.uniqueName)}
      appUrl={buildWebAppEntityUrl(page.uniqueName)}
      wide
    >
      <article className="atlas-entity">
        <header className="atlas-entity__hero">
          <div className="atlas-entity__portrait">
            <AtlasPicture
              src={picture}
              alt={page.name}
              size={560}
              eager
              className={`atlas-picture--hero ${page.painted ? '' : 'is-clay'}`}
            />
            {page.stages.length > 0 && (
              <div
                className="atlas-stages"
                role="list"
                aria-label={page.stagesLabel ?? messages.stages}
              >
                <button
                  type="button"
                  role="listitem"
                  className="atlas-stage"
                  aria-pressed={!stage}
                  onClick={() => setStageKey(undefined)}
                >
                  <AtlasPicture src={page.thumbnail} size={72} />
                  <span className="atlas-stage__label">{page.title ?? page.name}</span>
                </button>
                {page.stages.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    role="listitem"
                    className="atlas-stage"
                    aria-pressed={item.key === stage?.key}
                    onClick={() => setStageKey(item.key)}
                  >
                    <AtlasPicture src={item.thumbnail} size={72} />
                    <span className="atlas-stage__label">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="atlas-entity__intro">
            <p className="atlas-eyebrow">
              <SiteLink href={buildAtlasPath(language)}>{messages.breadcrumbHome}</SiteLink>
              <span aria-hidden="true"> · </span>
              <SiteLink href={buildAtlasFamilyPath(language, page.family)}>
                {messages.families[page.family]}
              </SiteLink>
            </p>
            <h1 className="atlas-title atlas-title--entity">{page.name}</h1>
            {subtitle && <p className="atlas-entity__subtitle">{subtitle}</p>}
            {stage && <p className="atlas-facts">{stage.chapters}</p>}
            {page.brief && page.brief !== subtitle && <p className="atlas-lead">{page.brief}</p>}
            {page.chapterCount > 0 && (
              <p className="atlas-facts">
                <a href="#passages">{countLabel(messages.chapters, page.chapterCount, language)}</a>
              </p>
            )}
            {(page.roles.length > 0 || page.strong.length > 0) && (
              <ul className="atlas-entity__chips">
                {page.roles.map(role => (
                  <li key={role} className="atlas-chip atlas-chip--quiet">
                    {role}
                  </li>
                ))}
                {page.strong.map(strong => (
                  <li key={strong.code}>
                    <SiteLink className="atlas-chip atlas-chip--strong" href={strong.path}>
                      {strong.label}
                    </SiteLink>
                  </li>
                ))}
              </ul>
            )}
            {page.series && (
              <p className="atlas-facts">
                {page.series.title} ·{' '}
                {messages.seriesPlace
                  .replace('{rank}', String(page.series.rank))
                  .replace('{total}', String(page.series.total))}
              </p>
            )}
          </div>
        </header>

        {page.cards.length > 0 && (
          <section className="atlas-entity__section atlas-entity__section--wide">
            <div className="atlas-entity__cards-head">
              <h2 className="atlas-heading">{messages.cards}</h2>
              <SiteLink
                className="resource-link"
                href={buildAtlasCardPath(language, page.cards[0].id)}
                hrefLang={language}
              >
                {messages.allCards}
              </SiteLink>
            </div>
            <AtlasCards cards={page.cards} language={language} />
          </section>
        )}

        {page.paragraphs.length > 0 && (
          <section className="atlas-entity__section atlas-entity__about">
            <h2 className="atlas-heading">{isPlace ? messages.aboutPlace : messages.about}</h2>
            <div className="resource-prose">
              {page.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        )}

        {page.point && (
          <section className="atlas-entity__section">
            <h2 className="atlas-heading">{messages.location}</h2>
            {page.place?.area && (
              <p className="atlas-facts">
                {messages.region}
                {language === 'fr' ? ' : ' : ': '}
                {page.place.area}
              </p>
            )}
            <AtlasMap
              language={language}
              points={[...page.neighbours, page.point]}
              focus={page.point}
              compact
            />
          </section>
        )}
        {isPlace && !page.point && (
          <section className="atlas-entity__section">
            <h2 className="atlas-heading">{messages.location}</h2>
            <p className="atlas-facts">{messages.locationUnknown}</p>
          </section>
        )}

        {page.relations.length > 0 && (
          <section className="atlas-entity__section">
            <h2 className="atlas-heading">{messages.relations}</h2>
            {page.relations.map(group => (
              <div key={group.kind} className="atlas-relations">
                <h3 className="atlas-relations__kind">
                  {messages.relationKinds[group.kind] ?? group.kind}
                </h3>
                <ul className="atlas-relations__list">
                  {group.items.map((item, index) => {
                    const content = (
                      <>
                        <AtlasPicture src={item.picture} size={44} />
                        <span>
                          {item.name}
                          {item.uncertain && (
                            <span className="atlas-relation__uncertain">
                              {' '}
                              ({messages.uncertain})
                            </span>
                          )}
                        </span>
                      </>
                    )
                    return (
                      <li key={`${item.path ?? item.name}-${index}`}>
                        {item.path ? (
                          <SiteLink className="atlas-relation" href={item.path}>
                            {content}
                          </SiteLink>
                        ) : (
                          <span className="atlas-relation">{content}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </section>
        )}

        {page.series && page.series.members.length > 1 && (
          <section className="atlas-entity__section atlas-entity__section--wide">
            <h2 className="atlas-heading">{page.series.title}</h2>
            <AtlasStrip label={page.series.title}>
              {page.series.members.map(member => (
                <AtlasTileLink
                  key={member.uniqueName}
                  tile={member}
                  language={language}
                  size="small"
                />
              ))}
            </AtlasStrip>
          </section>
        )}

        {page.passages.length > 0 && (
          <section className="atlas-entity__section" id="passages">
            <h2 className="atlas-heading">{messages.passages}</h2>
            <p className="atlas-facts">
              {messages.passagesCount
                .replace('{chapters}', page.chapterCount.toLocaleString(language))
                .replace('{verses}', page.verseCount.toLocaleString(language))}
            </p>
            <div className="atlas-passages">
              {page.passages.map(book => {
                const shown = book.chapters.slice(0, CHAPTERS_SHOWN)
                const rest = book.chapters.slice(CHAPTERS_SHOWN)
                const chapterLink = (chapter: (typeof book.chapters)[number]) =>
                  chapter.path ? (
                    <SiteLink key={chapter.chapter} className="atlas-passage" href={chapter.path}>
                      {chapter.chapter}
                    </SiteLink>
                  ) : (
                    <span key={chapter.chapter} className="atlas-passage">
                      {chapter.chapter}
                    </span>
                  )
                return (
                  <div key={book.book} className="atlas-passages__book">
                    <h3 className="atlas-passages__name">{book.name}</h3>
                    <div className="atlas-passages__chapters">
                      {shown.map(chapterLink)}
                      {rest.length > 0 && (
                        <details className="atlas-passages__more">
                          <summary>+{rest.length}</summary>
                          {rest.map(chapterLink)}
                        </details>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </article>
    </ResourceShell>
  )
}

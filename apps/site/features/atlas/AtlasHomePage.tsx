import ResourceShell from '../resources/ResourceShell'
import type { AtlasHomePageData } from './atlas.functions'
import AtlasMap from './AtlasMap'
import { AtlasPicture, AtlasSearch, AtlasStrip, AtlasTileLink } from './AtlasParts'
import {
  ATLAS_FAMILIES,
  buildAtlasEntityPath,
  buildAtlasFamilyPath,
  buildAtlasPath,
} from './atlasRoutes'
import { ATLAS_MESSAGES } from './messages'
import { WEB_APP_ORIGIN } from '../resources/publicSite'

/** How many painted figures stand in the line along the bottom of the opening. */
const LINE_UP = 11

/**
 * `/atlas/:language` — the atlas opens on its painted figures standing in a line, then gives
 * the series in the order of the story, the map of places, the painted places and beings, and
 * the families of every entity.
 */
export default function AtlasHomePage({ page }: { page: AtlasHomePageData }) {
  const { language } = page
  const messages = ATLAS_MESSAGES[language]
  // The first member of each series, then the next ones, so that the line spans the story.
  const lineUp = page.series
    .flatMap(series => series.members.slice(0, 2).map((member, rank) => ({ member, rank })))
    .sort((left, right) => left.rank - right.rank)
    .map(({ member }) => member)
    .filter(
      (member, index, all) =>
        all.findIndex(other => other.uniqueName === member.uniqueName) === index
    )
    .slice(0, LINE_UP)

  return (
    <ResourceShell
      section="atlas"
      alternatePath={buildAtlasPath(language === 'fr' ? 'en' : 'fr')}
      appUrl={`${WEB_APP_ORIGIN}/strong`}
      wide
    >
      <section className="atlas-hero">
        <div className="atlas-hero__text">
          <p className="atlas-eyebrow">{messages.homeEyebrow}</p>
          <h1 className="atlas-title">{messages.homeTitle}</h1>
          <p className="atlas-lead">
            {messages.homeLead.replace('{entities}', page.entityCount.toLocaleString(language))}
          </p>
          <AtlasSearch language={language} />
          <nav className="atlas-families" aria-label={messages.name}>
            {ATLAS_FAMILIES.map(family => (
              <a key={family} className="atlas-chip" href={buildAtlasFamilyPath(language, family)}>
                {messages.families[family]}
                <span className="atlas-chip__count">
                  {page.counts[family].toLocaleString(language)}
                </span>
              </a>
            ))}
          </nav>
        </div>
        <div className="atlas-lineup" aria-hidden="true">
          {lineUp.map((member, index) => (
            <a
              key={member.uniqueName}
              className="atlas-lineup__figure"
              href={buildAtlasEntityPath(language, member.uniqueName)}
              tabIndex={-1}
              style={
                { '--atlas-index': index, '--atlas-count': lineUp.length } as React.CSSProperties
              }
            >
              <img
                src={member.picture.replace('/w256.webp', '/w768.webp')}
                alt=""
                loading={index < 6 ? 'eager' : 'lazy'}
              />
            </a>
          ))}
        </div>
      </section>

      <section className="atlas-section">
        <header className="atlas-section__head">
          <h2 className="atlas-heading">{messages.series}</h2>
          <p className="atlas-section__lead">{messages.seriesLead}</p>
        </header>
        <div className="atlas-albums">
          {page.series.map(series => (
            <div key={series.id} className="atlas-album">
              <h3 className="atlas-album__title">{series.title}</h3>
              <div className="atlas-album__members">
                {series.members.map(member => (
                  <AtlasTileLink
                    key={member.uniqueName}
                    tile={member}
                    language={language}
                    size="small"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="atlas-section atlas-section--map" id="carte">
        <header className="atlas-section__head">
          <h2 className="atlas-heading">{messages.map}</h2>
          <p className="atlas-section__lead">
            {messages.mapLead.replace('{places}', page.points.length.toLocaleString(language))}
          </p>
        </header>
        <AtlasMap language={language} points={page.points} />
      </section>

      {page.places.length > 0 && (
        <section className="atlas-section">
          <header className="atlas-section__head">
            <h2 className="atlas-heading">{messages.families.places}</h2>
            <p className="atlas-section__lead">{messages.familyLeads.places}</p>
          </header>
          <AtlasStrip label={messages.families.places}>
            {page.places.map(place => (
              <a
                key={place.uniqueName}
                className="atlas-painting"
                href={buildAtlasEntityPath(language, place.uniqueName)}
              >
                <AtlasPicture src={place.picture.replace('/w256.webp', '/w768.webp')} size={300} />
                <span className="atlas-painting__name">{place.name}</span>
              </a>
            ))}
          </AtlasStrip>
          <p className="atlas-section__more">
            <a className="resource-link" href={buildAtlasFamilyPath(language, 'places')}>
              {messages.seeAll} · {page.counts.places.toLocaleString(language)}
            </a>
          </p>
        </section>
      )}

      {page.beings.length > 0 && (
        <section className="atlas-section">
          <header className="atlas-section__head">
            <h2 className="atlas-heading">{messages.families.beings}</h2>
            <p className="atlas-section__lead">{messages.familyLeads.beings}</p>
          </header>
          <AtlasStrip label={messages.families.beings}>
            {page.beings.map(being => (
              <AtlasTileLink key={being.uniqueName} tile={being} language={language} />
            ))}
          </AtlasStrip>
        </section>
      )}

      <section className="atlas-section">
        <div className="atlas-family-grid">
          {ATLAS_FAMILIES.map(family => (
            <a
              key={family}
              className="atlas-family-card"
              href={buildAtlasFamilyPath(language, family)}
            >
              <span className="atlas-family-card__count">
                {page.counts[family].toLocaleString(language)}
              </span>
              <span className="atlas-family-card__name">{messages.families[family]}</span>
              <span className="atlas-family-card__lead">{messages.familyLeads[family]}</span>
            </a>
          ))}
        </div>
      </section>
    </ResourceShell>
  )
}

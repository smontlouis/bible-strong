import ResourceShell from '../resources/ResourceShell'
import { WEB_APP_ORIGIN } from '../resources/publicSite'
import type { AtlasFamilyPageData } from './atlas.functions'
import AtlasMap from './AtlasMap'
import { AtlasSearch, AtlasTileLink } from './AtlasParts'
import { ATLAS_FAMILIES, buildAtlasFamilyPath, buildAtlasPath } from './atlasRoutes'
import { ATLAS_MESSAGES } from './messages'

/**
 * `/atlas/:language/:family` — a family of entities: its painted figures first, then the most
 * named of the others; the search reaches every one. The places add their map.
 */
export default function AtlasFamilyPage({ page }: { page: AtlasFamilyPageData }) {
  const { language, family } = page
  const messages = ATLAS_MESSAGES[language]
  return (
    <ResourceShell
      section="atlas"
      alternatePath={buildAtlasFamilyPath(language === 'fr' ? 'en' : 'fr', family)}
      appUrl={`${WEB_APP_ORIGIN}/strong`}
      wide
    >
      <section className="atlas-hero atlas-hero--family">
        <div className="atlas-hero__text">
          <p className="atlas-eyebrow">
            <a href={buildAtlasPath(language)}>{messages.name}</a>
          </p>
          <h1 className="atlas-title">{messages.families[family]}</h1>
          <p className="atlas-lead">{messages.familyLeads[family]}</p>
          <p className="atlas-facts">
            {messages.count.replace('{count}', page.count.toLocaleString(language))}
          </p>
          <AtlasSearch language={language} />
          <nav className="atlas-families" aria-label={messages.name}>
            {ATLAS_FAMILIES.filter(other => other !== family).map(other => (
              <a key={other} className="atlas-chip" href={buildAtlasFamilyPath(language, other)}>
                {messages.families[other]}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {page.points.length > 0 && (
        <section className="atlas-section atlas-section--map" id="carte">
          <header className="atlas-section__head">
            <h2 className="atlas-heading">{messages.map}</h2>
            <p className="atlas-section__lead">
              {messages.mapLead.replace('{places}', page.points.length.toLocaleString(language))}
            </p>
          </header>
          <AtlasMap language={language} points={page.points} />
        </section>
      )}

      {page.painted.length > 0 && (
        <section className="atlas-section">
          <header className="atlas-section__head">
            <h2 className="atlas-heading">{messages.painted}</h2>
          </header>
          <div className={family === 'places' ? 'atlas-grid atlas-grid--paintings' : 'atlas-grid'}>
            {page.painted.map(tile => (
              <AtlasTileLink key={tile.uniqueName} tile={tile} language={language} showChapters />
            ))}
          </div>
        </section>
      )}

      {page.mostNamed.length > 0 && (
        <section className="atlas-section">
          <header className="atlas-section__head">
            <h2 className="atlas-heading">{messages.mostNamed}</h2>
          </header>
          <div className="atlas-grid atlas-grid--small">
            {page.mostNamed.map(tile => (
              <AtlasTileLink
                key={tile.uniqueName}
                tile={tile}
                language={language}
                size="small"
                showChapters
              />
            ))}
          </div>
        </section>
      )}
    </ResourceShell>
  )
}

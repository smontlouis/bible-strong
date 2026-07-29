/**
 * PROTOTYPE ONLY.
 * Validated direction for the Strong detail page.
 */
const data = await fetch('./strong-detail.fixture.json?v=7', { cache: 'no-store' }).then(response =>
  response.json()
)

const app = document.querySelector('#app')
const requestedPage = new URLSearchParams(window.location.search).get('page')

const highlight = (text, selectedText = data.context.selectedText) =>
  text.replace(selectedText, `<mark>${selectedText}</mark>`)

const header = (title, detail) => `
  <div class="sheet-handle"></div>
  <header class="app-header">
    <div class="app-header__title">
      <h1>${title}</h1>
      <p>${detail}</p>
    </div>
    <button class="more-button" aria-label="Plus d’options">•••</button>
  </header>
`

const occurrenceLemmaId = occurrence =>
  occurrence.reference === 'Matt.16.18' ? 'common-noun' : 'proper-name'

const occurrences = (limit = 4) =>
  data.concordance.sample
    .slice(0, limit)
    .map(
      occurrence => `
        <article class="occurrence concordance-occurrence" data-lemma="${occurrenceLemmaId(occurrence)}">
          <strong>${occurrence.reference}</strong>
          <p>${highlight(occurrence.text)}</p>
        </article>
      `
    )
    .join('')

const lexicalGroupDefinitions = [
  { kind: 'subentry', title: 'Autres sens' },
  { kind: 'identity', title: 'Variantes et équivalents' },
  { kind: 'family', title: 'Même famille de mots' },
]

const lexicalRelationCard = (relation, className = '') => `
  <article class="lexical-relation ${className}">
    <div>
      <strong>${relation.gloss}</strong>
      <p>${relation.label} · ${relation.stepCode}</p>
    </div>
    <span class="lexical-relation__original">${relation.original}</span>
  </article>
`

const lexicalPreview = () => `
  <div class="lexical-list">
    ${data.entry.relations
      .slice(0, 4)
      .map(relation => lexicalRelationCard(relation))
      .join('')}
  </div>
`

const lexicalRelations = ({ preview = true } = {}) => {
  const groups = lexicalGroupDefinitions
    .map(group => ({
      ...group,
      relations: data.entry.relations.filter(relation => relation.groupKind === group.kind),
    }))
    .filter(group => group.relations.length > 0)
  return `
    <div class="lexical-preview ${preview ? '' : 'is-expanded'}">
      ${groups
        .map(
          group => `
            <section class="lexical-group">
              <h3>${group.title}</h3>
              <div class="lexical-list">
                ${group.relations
                  .map((relation, index) =>
                    lexicalRelationCard(relation, index > 0 ? 'lexical-relation--overflow' : '')
                  )
                  .join('')}
              </div>
            </section>
          `
        )
        .join('')}
    </div>
  `
}

const audioControl = () => `
  <button
    class="audio-button"
    data-audio
    aria-label="Écouter la prononciation"
    aria-pressed="false"
  >▶</button>
`

const personalRelationLabels = {
  father: 'père',
  partner: 'épouse',
  sibling: 'frère',
}

const silhouetteAvatar = sex => (sex === 'Female' ? './assets/female.png' : './assets/male.png')

const shortStrong = strong => strong?.match(/^[HG]\d{4}/u)?.[0] || strong || ''

const personalRelationGraph = () => {
  const relations = Object.fromEntries(
    data.entry.entity.relations.map(relation => [relation.relation, relation])
  )
  return `
    <div class="relation-map" role="img" aria-label="Relations personnelles de Pierre">
      <svg viewBox="0 0 330 318" aria-hidden="true">
        <path d="M165 140 C165 118 165 102 165 75" />
        <path d="M145 164 C113 178 82 198 56 228" />
        <path d="M185 164 C217 178 248 198 274 228" />
      </svg>
      <article class="relation-person relation-person--center">
        <div class="relation-avatar relation-avatar--center">
          <img src="${silhouetteAvatar(data.entry.entity.type)}" alt="" />
        </div>
        <strong>${data.entry.entity.name}</strong>
        <small>${shortStrong(data.entry.entity.uStrong)}</small>
      </article>
      ${['father', 'sibling', 'partner']
        .map(
          relationKind => `
            <article class="relation-person relation-person--${relationKind}">
              <div class="relation-avatar">
                <img src="${silhouetteAvatar(relations[relationKind].targetSex)}" alt="" />
              </div>
              <strong>${relations[relationKind].targetName}</strong>
              <small>${shortStrong(relations[relationKind].targetUStrong)}</small>
            </article>
          `
        )
        .join('')}
      ${['father', 'sibling', 'partner']
        .map(
          relationKind =>
            `<span class="relation-edge-label relation-edge-label--${relationKind}">${personalRelationLabels[relationKind]}</span>`
        )
        .join('')}
    </div>
  `
}

const entityReferences = (limit = 10, showRemaining = true) => `
  <div class="reference-cloud">
    ${data.entry.entity.references
      .slice(0, limit)
      .map(reference => `<span>${reference}</span>`)
      .join('')}
    ${
      showRemaining && data.entry.entity.referenceCount > limit
        ? `<span class="reference-cloud__more">+${data.entry.entity.referenceCount - limit}</span>`
        : ''
    }
  </div>
`

const personalRelationsAndReferences = ({ referenceLimit = 10, showRemaining = true } = {}) => `
  <section class="personal-connections">
    <h3>Relations personnelles</h3>
    ${personalRelationGraph()}
    <div class="subsection-heading">
      <h3>Premières références</h3>
      <span>${data.entry.entity.referenceCount} au total</span>
    </div>
    ${entityReferences(referenceLimit, showRemaining)}
  </section>
`

const entitySummary = ({
  showType = true,
  typeLabel = 'Personne biblique',
  showNotice = false,
} = {}) => `
  <article class="entity-summary">
    <div class="entity-summary__top">
      <div class="avatar" role="img" aria-label="Portrait d’homme">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="7.5" r="3.5" />
          <path d="M5.5 20c.5-4.2 3-6.5 6.5-6.5s6 2.3 6.5 6.5" />
        </svg>
      </div>
      <div>
        ${showType ? `<p class="eyebrow">${typeLabel}</p>` : ''}
        <h3>${data.entry.entity.name}</h3>
      </div>
    </div>
    <p>${data.entry.entity.shortDescription}</p>
    ${
      showNotice
        ? `<div class="details-body entity-article">${data.entry.entity.articleHtml}</div>`
        : ''
    }
  </article>
`

const pageHeader = title => `
  <div class="sheet-handle"></div>
  <header class="app-header detail-page-header">
    <button class="back-button" data-back aria-label="Retour">‹</button>
    <div class="app-header__title"><h1>${title}</h1></div>
  </header>
`

const previewLink = (page, label) => `
  <button class="preview-link" data-page="${page}">
    <span>${label}</span><span class="disclosure-arrow" aria-hidden="true">▸</span>
  </button>
`

const lemmaFilter = () => `
  <div class="lemma-filter">
    <div class="lemma-filter__chips">
      <button class="lemma-chip" data-lemma-filter="all" aria-pressed="true">Tous · ${data.concordance.count}</button>
      ${data.concordance.lemmas
        .map(
          lemma => `
            <button class="lemma-chip" data-lemma-filter="${lemma.id}" aria-pressed="false">
              ${lemma.lemma} · ${lemma.occurrenceCount}
            </button>
          `
        )
        .join('')}
    </div>
  </div>
`

const editorialContent = () => `
    <nav class="jump-nav">
      <a href="#c-context">Contexte</a>
      <a href="#c-sense">Sens</a>
      <a href="#c-person">Personnage</a>
      <a href="#c-related">Mots liés</a>
      <a href="#c-uses">Concordance</a>
    </nav>
    <div class="content">
      <section class="section" id="c-context">
        <p class="eyebrow">Dans son contexte</p>
        <blockquote class="editorial-quote">
          ${highlight(data.context.verseText)}
          <footer>
            <span>${data.context.reference} · ${data.context.version}</span>
            <span class="verse-morphology">
              ${data.context.token.morphology.meaning} ·
              ${data.context.token.morphology.code}
            </span>
          </footer>
        </blockquote>
      </section>

      <hr class="editorial-rule" />

      <section class="section" id="c-sense">
        <p class="eyebrow">Ce que le mot signifie</p>
        <div class="rich-text">${data.entry.definitionHtml}</div>
      </section>

      <section class="section">
        <p class="eyebrow">Éclairage du grec classique</p>
        <p class="resource-byline">
          ${data.entry.resources[0].source} · ${data.entry.resources[0].title}
        </p>
        <div class="resource-preview" data-resource-preview>
          <div class="resource-preview__content rich-text">${data.entry.resources[0].contentHtml}</div>
        </div>
        ${previewLink('resource', 'Lire le dictionnaire grec détaillé')}
      </section>

      <section class="section character-section" id="c-person">
        ${entitySummary({ typeLabel: 'Personne' })}
        ${personalRelationsAndReferences({ referenceLimit: 10 })}
        ${previewLink('person', `Voir la fiche de ${data.entry.entity.name}`)}
      </section>

      <section class="section" id="c-related">
        <p class="eyebrow">Mots liés</p>
        ${lexicalPreview()}
        ${previewLink('related', 'Voir tous les mots liés')}
      </section>

      <section class="section" id="c-uses">
        <p class="eyebrow">Concordance</p>
        <div class="count-row">
          <strong data-concordance-count>${data.concordance.count}</strong>
          <span class="muted">emplois dans ${data.concordance.version}</span>
        </div>
        ${lemmaFilter()}
        ${occurrences(3)}
        ${previewLink('concordance', 'Voir toute la concordance')}
      </section>
    </div>
`

const variantC = () => `
  <section class="prototype-shell">
    ${header('Étude de mot', `Grec · ${data.entry.stepCode}`)}
    <header class="editorial-header">
      <div class="editorial-header__codes">
        <span class="editorial-header__number">${data.entry.stepCode}</span>
      </div>
      <div class="editorial-header__identity-row">
        <div>
          <h2>${data.entry.original}</h2>
          <h3>${data.entry.gloss}</h3>
          <p>${data.entry.transliteration} · ${data.entry.pronunciation}</p>
        </div>
        ${audioControl()}
      </div>
    </header>
    ${editorialContent()}
  </section>
`

const personPage = () => `
  <section class="prototype-shell">
    ${pageHeader(data.entry.entity.name)}
    <div class="content detail-page-content">
      <section class="section detail-person-section">
        ${entitySummary({ typeLabel: 'Personne', showNotice: true })}
        ${personalRelationsAndReferences({
          referenceLimit: data.entry.entity.references.length,
          showRemaining: false,
        })}
      </section>
    </div>
  </section>
`

const resourcePage = () => `
  <section class="prototype-shell">
    ${pageHeader('Dictionnaire grec détaillé')}
    <div class="content detail-page-content">
      <section class="section">
        <p class="eyebrow">${data.entry.resources[0].source}</p>
        <p class="resource-byline">${data.entry.resources[0].title}</p>
        <div class="rich-text">${data.entry.resources[0].contentHtml}</div>
      </section>
    </div>
  </section>
`

const relatedPage = () => `
  <section class="prototype-shell">
    ${pageHeader('Mots liés')}
    <div class="content detail-page-content">
      <section class="section">
        <p class="eyebrow">${data.entry.original} · ${data.entry.gloss}</p>
        ${lexicalRelations({ preview: false })}
      </section>
    </div>
  </section>
`

const concordancePage = () => `
  <section class="prototype-shell">
    ${pageHeader('Concordance')}
    <div class="content detail-page-content">
      <section class="section">
        <div class="count-row">
          <strong data-concordance-count>${data.concordance.count}</strong>
          <span class="muted">emplois dans ${data.concordance.version}</span>
        </div>
        ${lemmaFilter()}
        ${occurrences(data.concordance.sample.length)}
      </section>
    </div>
  </section>
`

const detailPages = {
  person: personPage,
  resource: resourcePage,
  related: relatedPage,
  concordance: concordancePage,
}

app.innerHTML = detailPages[requestedPage]?.() ?? variantC()

document.querySelectorAll('[data-audio]').forEach(button => {
  button.addEventListener('click', () => {
    const isPlaying = button.getAttribute('aria-pressed') === 'true'
    window.speechSynthesis?.cancel()
    document.querySelectorAll('[data-audio]').forEach(audioButton => {
      audioButton.setAttribute('aria-pressed', 'false')
      audioButton.textContent = '▶'
    })
    if (!isPlaying) {
      button.setAttribute('aria-pressed', 'true')
      button.textContent = '■'
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(data.entry.original)
        utterance.lang = 'el-GR'
        utterance.rate = 0.72
        utterance.onend = () => {
          button.setAttribute('aria-pressed', 'false')
          button.textContent = '▶'
        }
        window.speechSynthesis.speak(utterance)
      }
    }
  })
})

document.querySelectorAll('[data-page]').forEach(button => {
  button.addEventListener('click', () => {
    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.set('page', button.dataset.page)
    nextUrl.hash = ''
    window.location.assign(nextUrl)
  })
})

document.querySelectorAll('[data-back]').forEach(button => {
  button.addEventListener('click', () => {
    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete('page')
    nextUrl.hash = ''
    window.location.assign(nextUrl)
  })
})

document.querySelectorAll('[data-lemma-filter]').forEach(button => {
  button.addEventListener('click', () => {
    const selectedLemma = button.dataset.lemmaFilter
    document.querySelectorAll('[data-lemma-filter]').forEach(chip => {
      chip.setAttribute('aria-pressed', String(chip === button))
    })
    document.querySelectorAll('.concordance-occurrence').forEach(occurrence => {
      occurrence.hidden = selectedLemma !== 'all' && occurrence.dataset.lemma !== selectedLemma
    })
    const count =
      selectedLemma === 'all'
        ? data.concordance.count
        : data.concordance.lemmas.find(lemma => lemma.id === selectedLemma)?.occurrenceCount
    document.querySelector('[data-concordance-count]').textContent = String(count ?? 0)
  })
})

import { entryCoversPassage, matchPassageReference, parsePassage } from './scripts/commentary-scope.mjs'
import { projectSdabcContent } from './shared/commentaryPresentation.js'

const state = {
  catalog: [],
  entries: [],
  libraryIndex: null,
  chapterKey: null,
  bookNames: {},
  passage: null,
  resource: 'all',
  tradition: 'all',
  tag: 'all',
  view: 'compare',
  registry: 'current',
}

const egwIndexedWritingsResource = {
  id: 'egw-writings',
  shortName: 'EGW Writings',
  title: 'EGW Writings',
  description: {
    en: 'Paragraphs from Ellen G. White writings linked to Bible passages by the Complete Scripture Index. Editorial chapter markers are expanded to the complete chapter while preserving a chapter-level association.',
  },
  author: 'Ellen G. White',
  era: 'XIXe–XXe siècles',
  tradition: 'Protestantisme',
  tags: ['Adventiste'],
  languages: ['en'],
  coverage: '83 277 paragraphes uniques reliés par 354 656 citations du Complete Scripture Index, avec expansion ciblée de 481 chapitres explicites et 423 sections indexées',
  rights: 'Ellen G. White Estate · autorisation personnalisée',
  licenseId: 'CustomPermission',
  status: 'available',
  source: 'EGW Writings · Complete Scripture Index, paragraphes ciblés et chapitres explicitement associés',
}

const elements = {
  catalogButton: document.querySelector('#catalog-button'),
  catalogCount: document.querySelector('#catalog-count'),
  bookSelect: document.querySelector('#book-select'),
  chapterSelect: document.querySelector('#chapter-select'),
  commentaryStack: document.querySelector('#commentary-stack'),
  datasetNote: document.querySelector('#dataset-note'),
  emptyState: document.querySelector('#empty-state'),
  passageKicker: document.querySelector('#passage-kicker'),
  passageList: document.querySelector('#passage-list'),
  passageTitle: document.querySelector('#passage-title'),
  readingRoom: document.querySelector('.reading-room'),
  referenceInput: document.querySelector('#reference-input'),
  registryContent: document.querySelector('#registry-content'),
  registryPanel: document.querySelector('#registry-panel'),
  resourceFilter: document.querySelector('#resource-filter'),
  tagFilter: document.querySelector('#tag-filter'),
  traditionFilter: document.querySelector('#tradition-filter'),
}

const passageNames = {
  1: 'Genèse', 2: 'Exode', 19: 'Psaumes', 23: 'Ésaïe', 40: 'Matthieu', 43: 'Jean',
  45: 'Romains', 46: '1 Corinthiens', 58: 'Hébreux', 66: 'Apocalypse',
}

const osisBooks = [
  'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs',
  '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov', 'Eccl', 'Song',
  'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah',
  'Hab', 'Zeph', 'Hag', 'Zech', 'Mal', 'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom',
  '1Cor', '2Cor', 'Gal', 'Eph', 'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim', 'Titus',
  'Phlm', 'Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev', 'Tob',
  'Jdt', 'Wis', 'Sir', 'Bar', '1Macc', '2Macc',
]
const osisBookNumbers = new Map(osisBooks.map((book, index) => [book, index + 1]))

const formatPassage = passage => {
  const [book, chapter, verse] = passage.split('-')
  const bookName = state.bookNames[book] ?? passageNames[book] ?? `Livre ${book}`
  return Number(verse) === 0 ? `${bookName} ${chapter} — introduction` : `${bookName} ${chapter}.${verse}`
}

const initials = name => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toLocaleUpperCase('fr')

const sanitizeHtml = (unsafeHtml, references = []) => {
  if (!unsafeHtml) return ''
  const allowedTags = new Set(['B', 'BLOCKQUOTE', 'BR', 'EM', 'H2', 'H3', 'H4', 'HR', 'I', 'LI', 'OL', 'P', 'SPAN', 'STRONG', 'SUB', 'SUP', 'UL'])
  const blockedTags = new Set(['EMBED', 'FORM', 'IFRAME', 'OBJECT', 'SCRIPT', 'STYLE', 'SVG'])
  const referencesById = new Map(references.map(reference => [reference.id, reference]))
  const documentFragment = new DOMParser().parseFromString(`<body>${unsafeHtml}</body>`, 'text/html')
  const clean = node => {
    for (const child of [...node.children]) {
      if (blockedTags.has(child.tagName)) {
        child.remove()
        continue
      }
      if (!allowedTags.has(child.tagName)) {
        const children = [...child.childNodes]
        child.replaceWith(...children)
        clean(node)
        continue
      }
      const referenceId = child.tagName === 'SPAN' ? child.getAttribute('data-reference-id') : null
      for (const attribute of [...child.attributes]) {
        const allowedClass = attribute.name === 'class' && /^(?:bible-ref|ref|source-ref|greek-hebrew|translit)$/.test(attribute.value)
        const allowedReferenceId = child.tagName === 'SPAN' && attribute.name === 'data-reference-id' && referencesById.has(attribute.value)
        if (!allowedClass && !allowedReferenceId) child.removeAttribute(attribute.name)
      }
      if (child.classList.contains('bible-ref')) {
        const reference = referencesById.get(referenceId)
        if (reference?.kind === 'bible' && /^[1-4]?[A-Za-z]+\.\d+(?:\.\d+)?(?:[-,][\w.,-]+)*$/.test(reference.osis)) {
          child.setAttribute('data-osis', reference.osis)
          child.setAttribute('role', 'link')
          child.setAttribute('tabindex', '0')
          child.setAttribute('title', reference.osis)
        } else {
          child.classList.remove('bible-ref')
          child.removeAttribute('data-reference-id')
        }
      }
      clean(child)
    }
  }
  clean(documentFragment.body)
  return documentFragment.body.innerHTML
}

const catalogById = id => state.catalog.find(resource => resource.id === id)

const chunk = (values, size) => Array.from(
  { length: Math.ceil(values.length / size) },
  (_, index) => values.slice(index * size, (index + 1) * size)
)

const projectEgwIndexedWritings = async entries => {
  const scriptureIndexEntries = entries.filter(entry => entry.editorialKind === 'scripture-index')
  if (scriptureIndexEntries.length === 0) return entries
  const paragraphIds = [...new Set(scriptureIndexEntries.flatMap(entry =>
    entry.citations.flatMap(citation => citation.associatedParagraphIds ?? [citation.paragraphId])
  ))]
  const responses = await Promise.all(chunk(paragraphIds, 150).map(async ids => {
    const response = await fetch(`./api/egw-paragraphs?ids=${encodeURIComponent(ids.join(','))}`)
    if (!response.ok) throw new Error('La ressource des paragraphes EGW est indisponible. Relancez son export.')
    return response.json()
  }))
  const missingIds = responses.flatMap(response => response.missingIds)
  if (missingIds.length > 0) throw new Error(`${missingIds.length} paragraphes EGW ciblés sont absents de la ressource locale.`)
  const paragraphsById = new Map(responses.flatMap(response => response.paragraphs).map(paragraph => [paragraph.id, paragraph]))
  const projected = scriptureIndexEntries.map(entry => ({
    ...entry,
    id: `egw-indexed-writings:${entry.id}`,
    resource: egwIndexedWritingsResource,
    editorialKind: 'egw-indexed-writings',
    layer: 'egw-indexed-writings',
    paragraphs: entry.citations.flatMap(citation =>
      (citation.associatedParagraphIds ?? [citation.paragraphId]).map(paragraphId => ({
        ...paragraphsById.get(paragraphId),
        citationLabel: citation.label,
        association: citation.association ?? null,
      }))
    ),
  }))
  return [
    ...entries.filter(entry => entry.editorialKind !== 'scripture-index' && entry.editorialKind !== 'egw-indexed-writings'),
    ...projected,
  ]
}

const passageGroups = () => {
  const indexedPassages = state.libraryIndex
    ? state.libraryIndex.chapters.find(chapter => `${chapter.book}-${chapter.chapter}` === state.chapterKey)?.passages ?? []
    : []
  const passages = indexedPassages.length ? indexedPassages : [...new Set(state.entries.map(entry => entry.passage))]
  return passages
    .map(passage => [passage, state.entries.filter(entry => entryCoversPassage(entry, passage))])
    .filter(([, entries]) => entries.length)
    .sort(([left], [right]) => left.localeCompare(right, 'fr', { numeric: true }))
}

const availableChapters = book => state.libraryIndex?.chapters.filter(chapter => chapter.book === Number(book)) ?? []

const renderChapterSelectors = () => {
  if (!state.libraryIndex) {
    elements.bookSelect.closest('.chapter-picker').hidden = true
    return
  }
  const books = [...new Map(state.libraryIndex.chapters.map(chapter => [chapter.book, chapter.bookName]))]
  const currentBook = Number(state.chapterKey?.split('-')[0] ?? books[0]?.[0])
  elements.bookSelect.innerHTML = books.map(([id, name]) => `<option value="${id}" ${id === currentBook ? 'selected' : ''}>${name}</option>`).join('')
  const chapters = availableChapters(currentBook)
  const currentChapter = Number(state.chapterKey?.split('-')[1] ?? chapters[0]?.chapter)
  elements.chapterSelect.innerHTML = chapters.map(chapter => `<option value="${chapter.chapter}" ${chapter.chapter === currentChapter ? 'selected' : ''}>${chapter.chapter}</option>`).join('')
}

const renderPassages = () => {
  elements.passageList.innerHTML = passageGroups().map(([passage, entries], index) => `
    <button class="passage-item ${passage === state.passage ? 'active' : ''}" type="button" data-passage="${passage}">
      <span class="number">${String(index + 1).padStart(2, '0')}</span>
      <span>${formatPassage(passage)}</span>
      <span class="count">${entries.length}</span>
    </button>
  `).join('')
}

const renderFilters = () => {
  const availableResourceIds = [...new Set(state.entries.map(entry => entry.resource.id))]
  elements.resourceFilter.innerHTML = '<option value="all">Toutes les voix</option>' + availableResourceIds.map(id => {
    const resource = catalogById(id)
    return `<option value="${id}">${resource?.shortName ?? id}</option>`
  }).join('')
  const traditions = [...new Set(availableResourceIds.map(id => catalogById(id)?.tradition).filter(Boolean))].sort()
  elements.traditionFilter.innerHTML = '<option value="all">Toutes</option>' + traditions.map(tradition => `<option value="${tradition}">${tradition}</option>`).join('')
  const tags = [...new Set(availableResourceIds.flatMap(id => catalogById(id)?.tags ?? []))].sort((left, right) => left.localeCompare(right, 'fr'))
  elements.tagFilter.innerHTML = '<option value="all">Tous</option>' + tags.map(tag => `<option value="${tag}">${tag}</option>`).join('')
}

const translationForPassage = (entry, passage) => {
  if (passage === entry.passage || !entry.translationVariants?.length) return entry.translation
  const variant = entry.translationVariants.find(candidate => candidate.passage === passage)
  return variant ? variant.translation : entry.translation
}

const cardStatus = translation => {
  if (!translation) return ['source-only', 'EN uniquement']
  return ['available', 'FR disponible']
}

const renderProseHtml = (content, language) => {
  return `<div class="prose-shell commentary-copy collapsed"><div class="prose" lang="${language}">${content}</div><button class="expand-copy" type="button" data-collapsed-label="Lire plus" data-expanded-label="Réduire">Lire plus</button></div>`
}

const renderProse = (document, language) =>
  renderProseHtml(sanitizeHtml(document?.html, document?.references), language)

const syncProseOverflow = () => {
  document.querySelectorAll('.commentary-copy').forEach(shell => {
    const prose = shell.querySelector('.prose')
    const button = shell.querySelector('.expand-copy')
    const lineHeight = Number.parseFloat(getComputedStyle(prose).lineHeight)
    const overflowsFiveLines = prose.scrollHeight > lineHeight * 5 + 1
    shell.classList.toggle('collapsed', overflowsFiveLines)
    shell.classList.toggle('is-expandable', overflowsFiveLines)
    button.hidden = !overflowsFiveLines
    button.textContent = button.dataset.collapsedLabel
  })
}

const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const renderTaxonomy = resource => `
  <div class="commentary-tags" aria-label="Tradition et tags">
    <span class="tradition-tag">${escapeHtml(resource.tradition)}</span>
    ${(resource.tags ?? []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}
  </div>
`

const scopeNames = {
  verse: 'Verset',
  range: 'Plage',
  section: 'Section',
  chapter: 'Chapitre entier',
  book: 'Introduction du livre',
  homily: 'Homélie',
}

const scopeLabel = scope => {
  if (!scope.end) return scope.kind === 'verse' ? formatPassage(scope.start) : scopeNames[scope.kind] ?? formatPassage(scope.start)
  const start = parsePassage(scope.start)
  const end = parsePassage(scope.end)
  if (start && end && start.book === end.book && start.chapter === end.chapter) {
    return `${formatPassage(scope.start)}–${end.verse}`
  }
  if (start && end && start.book === end.book) {
    return `${formatPassage(scope.start)}–${end.chapter}.${end.verse}`
  }
  return `${formatPassage(scope.start)}–${formatPassage(scope.end)}`
}

const renderScope = entry => {
  const scope = entry.scope ?? { kind: 'verse', start: entry.passage }
  const inferred = scope.confidence === 'high' ? ' · titre interprété' : ''
  return `<span class="scope-badge scope-${escapeHtml(scope.kind)}">${escapeHtml(scopeLabel(scope))}${inferred}</span>`
}

const renderEgwIndexedWritings = (entries, index) => {
  const paragraphsById = new Map()
  for (const entry of entries) {
    const indexScope = entry.scope ?? { kind: 'verse', start: entry.passage }
    const indexScopeKey = `${indexScope.kind}:${indexScope.start}:${indexScope.end ?? ''}`
    for (const paragraph of entry.paragraphs) {
      const current = paragraphsById.get(paragraph.id) ?? { ...paragraph, indexScopes: [] }
      if (!current.indexScopes.some(scope => scope.key === indexScopeKey)) {
        current.indexScopes.push({ ...indexScope, key: indexScopeKey })
      }
      if (paragraph.association?.kind === 'chapter' || (!current.association && paragraph.association?.kind === 'section')) {
        current.association = paragraph.association
      }
      paragraphsById.set(paragraph.id, current)
    }
  }
  const paragraphs = [...paragraphsById.values()]
  const groups = [...paragraphs.reduce((map, paragraph) => {
    const key = `${paragraph.book.id}:${paragraph.section.title}`
    const group = map.get(key) ?? { book: paragraph.book, section: paragraph.section, paragraphs: [], association: null, indexScopes: new Map() }
    if (paragraph.association?.kind === 'chapter' || (!group.association && paragraph.association?.kind === 'section')) {
      group.association = paragraph.association
    }
    for (const scope of paragraph.indexScopes) group.indexScopes.set(scope.key, scope)
    group.paragraphs.push(paragraph)
    map.set(key, group)
    return map
  }, new Map()).values()]
  for (const group of groups) {
    group.paragraphs.sort((left, right) => left.id.localeCompare(right.id, 'en', { numeric: true }))
  }
  const content = groups.map(group => `
    <section class="egw-writing-group">
      <header>
        <div><h4>${escapeHtml(group.book.title)}</h4><p>${escapeHtml(group.section.title)}</p></div>
        <div class="egw-writing-group-labels">
          ${group.association ? `<span class="chapter-association-badge">${group.association.kind === 'chapter' ? 'Chapitre complet' : 'Section complète'}</span>` : ''}
          ${group.book.code ? `<span>${escapeHtml(group.book.code)}</span>` : ''}
        </div>
      </header>
      <div class="egw-index-scopes">
        <span>Portée ECSI</span>
        <div>${[...group.indexScopes.values()].map(scope => `<span class="scope-badge scope-${escapeHtml(scope.kind)}">${escapeHtml(scopeLabel(scope))}</span>`).join('')}</div>
      </div>
      ${group.association ? `
        <div class="chapter-association-note">
          <p>${group.association.kind === 'chapter'
            ? 'L’autrice déclare explicitement la portée biblique de ce chapitre. Il est donc présenté une seule fois comme unité documentaire, sans rattacher artificiellement chacun de ses paragraphes à chaque verset.'
            : 'L’index pointe vers le titre de cette section. Son contenu est donc présenté comme une seule unité documentaire ; sa portée biblique est déduite de l’ensemble des entrées ECSI qui citent cette ancre.'}</p>
          ${group.association.scriptureScope?.label ? `<span class="scope-badge scope-${group.association.kind}">${escapeHtml(group.association.scriptureScope.label)}</span>` : ''}
          <a class="egw-context-link" href="${escapeHtml(group.association.contextUrl ?? group.section.contextUrl)}" target="_blank" rel="noreferrer">Voir l’unité dans son contexte ↗</a>
        </div>
      ` : ''}
      <div class="egw-writing-paragraphs">
        ${group.paragraphs.map(paragraph => `
          <article class="egw-writing-paragraph">
            <div class="egw-paragraph-reference">${escapeHtml(paragraph.sourceReference ?? paragraph.citationLabel ?? paragraph.id)}</div>
            ${renderProse(paragraph.source, paragraph.source.language ?? 'en')}
            ${group.association ? '' : `<a class="egw-context-link" href="${escapeHtml(paragraph.section.contextUrl)}" target="_blank" rel="noreferrer">Voir dans son contexte ↗</a>`}
          </article>
        `).join('')}
      </div>
    </section>
  `).join('')
  return `
    <article class="commentary-card egw-writings-card" style="animation-delay:${index * 70}ms">
      <header class="commentary-head">
        <div class="commentary-identity">
          <span class="author-seal">EGW</span>
          <div><h3>${egwIndexedWritingsResource.title}</h3><p>Ellen G. White · associations issues du Complete Scripture Index</p><div class="commentary-meta">${renderTaxonomy(egwIndexedWritingsResource)}</div></div>
        </div>
        <span class="status-badge available">${paragraphs.length} paragraphe${paragraphs.length > 1 ? 's' : ''}</span>
      </header>
      <div class="egw-writings-body">
        <p class="index-explanation">Ces textes sont associés à ce passage par l’index scripturaire EGW. Cette association ne signifie pas nécessairement qu’il s’agit d’un commentaire exégétique.</p>
        ${content}
      </div>
    </article>
  `
}

const sdabcDocumentForLanguage = (entry, passage, language) => {
  if (language === 'en') return entry.source?.language === 'en' ? entry.source : null
  const translation = translationForPassage(entry, passage)
  return translation?.language === language ? translation : null
}

const projectSdabcLanguage = (entries, passage, language) => projectSdabcContent(
  entries.map(entry => {
    const document = sdabcDocumentForLanguage(entry, passage, language)
    return {
      id: entry.id,
      layer: entry.layer ?? entry.editorialKind,
      html: sanitizeHtml(document?.html, document?.references),
    }
  })
)

const renderSdabc = (entries, resource, index) => {
  const french = projectSdabcLanguage(entries, state.passage, 'fr')
  const english = projectSdabcLanguage(entries, state.passage, 'en')
  const [statusClass, statusLabel] = cardStatus(french ? { html: french } : null)
  return `
    <article class="commentary-card" style="animation-delay:${index * 70}ms">
      <header class="commentary-head">
        <div class="commentary-identity">
          <span class="author-seal">${initials(resource.author)}</span>
          <div><h3>${resource.shortName ?? resource.title}</h3><p>${resource.author} · ${resource.era ?? ''}</p><div class="commentary-meta">${renderTaxonomy(resource)}</div></div>
        </div>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </header>
      <div class="commentary-columns">
        <section class="commentary-column" data-language="fr">
          <div class="column-label"><span>Français</span><span>${french ? 'disponible' : 'absent'}</span></div>
          ${french ? renderProseHtml(french, 'fr') : '<div class="missing-copy">Traduction française absente du corpus local.<br />Ce passage figure dans le lot à compléter.</div>'}
        </section>
        <section class="commentary-column" data-language="en">
          <div class="column-label"><span>English source</span><span>${english ? 'disponible' : 'absente'}</span></div>
          ${english ? renderProseHtml(english, 'en') : '<div class="missing-copy">Source anglaise non incluse dans ce corpus local.</div>'}
        </section>
      </div>
    </article>
  `
}

const renderComments = () => {
  const entries = state.entries.filter(entry => {
    if (!entryCoversPassage(entry, state.passage)) return false
    if (state.resource !== 'all' && entry.resource.id !== state.resource) return false
    const resource = catalogById(entry.resource.id)
    if (state.tradition !== 'all' && resource?.tradition !== state.tradition) return false
    return state.tag === 'all' || resource?.tags?.includes(state.tag)
  })

  elements.passageTitle.textContent = state.passage ? formatPassage(state.passage) : 'Aucun passage'
  const sdabcCommentaries = entries.filter(entry =>
    entry.resource.id === 'sdabc'
  )
  const egwIndexedWritings = entries.filter(entry => entry.editorialKind === 'egw-indexed-writings')
  const displayEntries = []
  let sdabcProjectionInserted = false
  let egwProjectionInserted = false
  for (const entry of entries) {
    if (entry.editorialKind === 'egw-indexed-writings') {
      if (!egwProjectionInserted) {
        displayEntries.push({ kind: 'egw-indexed-writings-projection', entries: egwIndexedWritings })
        egwProjectionInserted = true
      }
      continue
    }
    if (entry.resource.id !== 'sdabc') {
      displayEntries.push(entry)
      continue
    }
    if (!sdabcProjectionInserted && sdabcCommentaries.length > 0) {
      displayEntries.push({ kind: 'sdabc-projection', entries: sdabcCommentaries })
      sdabcProjectionInserted = true
    }
  }

  elements.passageKicker.textContent = `${displayEntries.length} ${displayEntries.length > 1 ? 'voix disponibles' : 'voix disponible'}`

  elements.commentaryStack.innerHTML = displayEntries.map((entry, index) => {
    if (entry.kind === 'sdabc-projection') {
      const resource = catalogById('sdabc') ?? entry.entries[0].resource
      return renderSdabc(entry.entries, resource, index)
    }
    if (entry.kind === 'egw-indexed-writings-projection') return renderEgwIndexedWritings(entry.entries, index)
    const resource = catalogById(entry.resource.id) ?? entry.resource
    const isEgwSupplement = entry.editorialKind === 'egw-supplement'
    const voiceAuthor = isEgwSupplement ? 'Ellen G. White' : resource.author
    const voiceTitle = isEgwSupplement ? 'Complément EGW' : (resource.shortName ?? resource.title)
    const translation = translationForPassage(entry, state.passage)
    const [statusClass, statusLabel] = cardStatus(translation)
    const french = translation?.html
      ? renderProse(translation, translation.language ?? 'fr')
      : '<div class="missing-copy">Traduction française absente du corpus local.<br />Ce segment figure dans le lot à compléter.</div>'
    return `
      <article class="commentary-card" style="animation-delay:${index * 70}ms">
        <header class="commentary-head">
          <div class="commentary-identity">
            <span class="author-seal">${initials(voiceAuthor)}</span>
            <div><h3>${voiceTitle}</h3><p>${voiceAuthor} · ${entry.volumeCode ? `${entry.volumeCode} · ` : ''}${resource.era ?? ''}</p><div class="commentary-meta">${renderScope(entry)}${renderTaxonomy(resource)}</div></div>
          </div>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </header>
        <div class="commentary-columns">
          <section class="commentary-column" data-language="fr">
            <div class="column-label"><span>Français</span><span>${translation ? 'disponible' : 'absent'}</span></div>
            ${french}
          </section>
          <section class="commentary-column" data-language="en">
            <div class="column-label"><span>English source</span><span>${entry.source.sha256?.slice(0, 8) ?? 'non incluse'}</span></div>
            ${entry.source.html ? renderProse(entry.source, entry.source.language ?? 'en') : `<div class="missing-copy">${entry.source.language === 'fr' ? 'Cette édition est directement française ; aucune version anglaise associée.' : 'Source anglaise non incluse dans ce corpus local.'}</div>`}
          </section>
        </div>
      </article>
    `
  }).join('')
  elements.emptyState.hidden = displayEntries.length > 0
  requestAnimationFrame(syncProseOverflow)
  renderRegistry()
}

const descriptionLanguageNames = { en: 'English', fr: 'Français' }

const renderResourceDescriptions = resource => resource.languages
  .filter(language => resource.description?.[language])
  .map(language => `
    <div class="resource-description" lang="${language}">
      <span>${descriptionLanguageNames[language] ?? language.toLocaleUpperCase('fr')}</span>
      <p>${escapeHtml(resource.description[language])}</p>
    </div>
  `).join('')

const renderRegistryCard = resource => `
  <article class="registry-card">
    <h3>${resource.title}</h3>
    <p>${resource.author} · ${resource.era}</p>
    <div class="resource-descriptions">${renderResourceDescriptions(resource)}</div>
    <span class="registry-status ${resource.status}">${resource.status}</span>
    <dl>
      <dt>Tradition</dt><dd>${resource.tradition}</dd>
      <dt>Tags</dt><dd>${resource.tags?.join(' · ') || '—'}</dd>
      <dt>Langues</dt><dd>${resource.languages.join(' / ').toLocaleUpperCase('fr')}</dd>
      <dt>Couverture</dt><dd>${resource.coverage}</dd>
      <dt>Copyright</dt><dd>${resource.rights}</dd>
      <dt>Source</dt><dd>${resource.source}</dd>
    </dl>
  </article>
`

const renderRegistry = () => {
  const resources = state.registry === 'catalog'
    ? state.catalog
    : [...new Set(state.entries.filter(entry => entryCoversPassage(entry, state.passage)).map(entry => entry.resource.id))]
        .map(catalogById).filter(Boolean)
  elements.registryContent.innerHTML = resources.map(renderRegistryCard).join('') || '<p>Aucune ressource sélectionnée.</p>'
}

const loadChapter = async (chapter, preferredPassage = null) => {
  if (!chapter) return
  elements.passageTitle.textContent = 'Chargement…'
  const descriptors = [...new Map([
    ...Object.values(chapter.resources),
    ...(chapter.coverageChunks ?? []),
  ].map(descriptor => [descriptor.path, descriptor])).values()]
  const payloads = await Promise.all(descriptors.map(async resource => {
    const response = await fetch(`./.local/library/${resource.path}`)
    if (!response.ok) throw new Error(`Chapitre JSON introuvable : ${resource.path}`)
    return response.json()
  }))
  const chapterEntries = [...new Map(payloads.flatMap(payload => payload.entries).map(entry => [entry.id, entry])).values()]
  state.entries = await projectEgwIndexedWritings(chapterEntries)
  state.chapterKey = `${chapter.book}-${chapter.chapter}`
  const passages = passageGroups().map(([passage]) => passage)
  state.passage = preferredPassage && passages.includes(preferredPassage) ? preferredPassage : passages[0] ?? null
  state.resource = 'all'
  state.tradition = 'all'
  state.tag = 'all'
  renderChapterSelectors()
  renderFilters()
  renderPassages()
  renderComments()
}

const selectPassage = async passage => {
  const targetChapterKey = passage.split('-').slice(0, 2).join('-')
  if (state.libraryIndex && targetChapterKey !== state.chapterKey) {
    const chapter = state.libraryIndex.chapters.find(candidate => `${candidate.book}-${candidate.chapter}` === targetChapterKey)
    await loadChapter(chapter, passage)
    return
  }
  state.passage = passage
  renderPassages()
  renderComments()
}

const passageFromOsis = osis => {
  const first = String(osis).split(',')[0].split('-')[0]
  const match = /^([1-4]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$/u.exec(first)
  const book = match ? osisBookNumbers.get(match[1]) : null
  if (!book) return null
  return `${book}-${Number(match[2])}-${Number(match[3] ?? 1)}`
}

const openBibleReference = async element => {
  const passage = passageFromOsis(element?.dataset.osis)
  if (passage) await selectPassage(passage)
}

elements.passageList.addEventListener('click', async event => {
  const button = event.target.closest('[data-passage]')
  if (button) await selectPassage(button.dataset.passage)
})
elements.referenceInput.addEventListener('keydown', async event => {
  if (event.key !== 'Enter') return
  const passages = state.libraryIndex
    ? state.libraryIndex.chapters.flatMap(chapter => chapter.passages)
    : passageGroups().map(([passage]) => passage)
  const match = matchPassageReference(
    passages,
    event.currentTarget.value,
    formatPassage,
  )
  if (match) await selectPassage(match)
})
elements.bookSelect.addEventListener('change', async event => {
  const chapters = availableChapters(event.target.value)
  const chapter = chapters.find(candidate => candidate.chapter === 1) ?? chapters[0]
  await loadChapter(chapter)
})
elements.chapterSelect.addEventListener('change', async event => {
  const chapter = availableChapters(elements.bookSelect.value).find(candidate => candidate.chapter === Number(event.target.value))
  await loadChapter(chapter)
})
elements.resourceFilter.addEventListener('change', event => { state.resource = event.target.value; renderComments() })
elements.traditionFilter.addEventListener('change', event => { state.tradition = event.target.value; renderComments() })
elements.tagFilter.addEventListener('change', event => { state.tag = event.target.value; renderComments() })
elements.commentaryStack.addEventListener('click', async event => {
  const reference = event.target.closest('.bible-ref[data-osis]')
  if (reference) {
    await openBibleReference(reference)
    return
  }
  const button = event.target.closest('.expand-copy')
  if (!button) return
  const shell = button.closest('.prose-shell')
  shell.classList.toggle('collapsed')
  button.textContent = shell.classList.contains('collapsed')
    ? (button.dataset.collapsedLabel ?? 'Lire plus')
    : (button.dataset.expandedLabel ?? 'Réduire')
})
elements.commentaryStack.addEventListener('keydown', async event => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const reference = event.target.closest('.bible-ref[data-osis]')
  if (!reference) return
  event.preventDefault()
  await openBibleReference(reference)
})
document.querySelector('.view-toggle').addEventListener('click', event => {
  const button = event.target.closest('[data-view]')
  if (!button) return
  state.view = button.dataset.view
  document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item === button))
  elements.readingRoom.dataset.view = state.view
  requestAnimationFrame(syncProseOverflow)
})

let resizeFrame = null
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(syncProseOverflow)
})
document.querySelector('.registry-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-registry]')
  if (!button) return
  state.registry = button.dataset.registry
  document.querySelectorAll('[data-registry]').forEach(item => item.classList.toggle('active', item === button))
  renderRegistry()
})
elements.catalogButton.addEventListener('click', () => {
  state.registry = 'catalog'
  document.querySelectorAll('[data-registry]').forEach(item => item.classList.toggle('active', item.dataset.registry === 'catalog'))
  elements.registryPanel.classList.toggle('open')
  renderRegistry()
})

const load = async () => {
  try {
    const [catalogResponse, libraryResponse] = await Promise.all([
      fetch('./data/catalog.json'),
      fetch('./.local/library/index.json'),
    ])
    if (!catalogResponse.ok) throw new Error('Le catalogue JSON local est introuvable.')
    const catalog = await catalogResponse.json()
    state.catalog = catalog.resources
    if (!state.catalog.some(resource => resource.id === egwIndexedWritingsResource.id)) {
      state.catalog.push(egwIndexedWritingsResource)
    }
    elements.catalogCount.textContent = state.catalog.length

    if (libraryResponse.ok) {
      state.libraryIndex = await libraryResponse.json()
      for (const chapter of state.libraryIndex.chapters) state.bookNames[chapter.book] = chapter.bookName
      const resources = Object.values(state.libraryIndex.resources)
      const total = resources.reduce((sum, resource) => sum + resource.entryCount, 0)
      const anchors = resources.reduce((sum, resource) => sum + (resource.sourceAnchorCount ?? resource.entryCount), 0)
      elements.datasetNote.textContent = `${total.toLocaleString('fr-FR')} unités éditoriales · ${anchors.toLocaleString('fr-FR')} ancres source · bibliothèque ${state.libraryIndex.generatedAt.slice(0, 10)}`
      const firstChapter = state.libraryIndex.chapters.find(chapter => chapter.book === 1 && chapter.chapter === 1) ?? state.libraryIndex.chapters[0]
      await loadChapter(firstChapter, '1-1-1')
    } else {
      const commentsResponse = await fetch('./data/comments.json')
      if (!commentsResponse.ok) throw new Error('Les fichiers JSON locaux sont introuvables.')
      const dataset = await commentsResponse.json()
      state.entries = dataset.entries
      state.passage = passageGroups()[0]?.[0] ?? null
      elements.datasetNote.textContent = `${state.entries.length} unités · échantillon ${dataset.generatedAt?.slice(0, 10) ?? 'local'}`
      renderChapterSelectors()
      renderFilters()
      renderPassages()
      renderComments()
    }
  } catch (error) {
    elements.passageTitle.textContent = 'Données indisponibles'
    elements.commentaryStack.innerHTML = `<div class="missing-copy">${error.message}<br />Lancez le serveur local depuis le dossier du prototype.</div>`
  }
}

load()

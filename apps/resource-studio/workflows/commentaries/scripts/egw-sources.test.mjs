import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mergeEgwLayers,
  isIndexedSectionAnchor,
  normalizeEgwMarkup,
  parseBookTocSectionPages,
  parseCommentaryPage,
  parseCommentaryToc,
  parseIndexedParagraphContext,
  parseIndexedParagraphPage,
  parseIndexedHeadingSectionPage,
  parseIndexedSectionPage,
  parseScriptureIndexPage,
  parseScriptureIndexToc,
  parseChapterAssociationScriptureScope,
  scriptureScopeCoversPassage,
} from './egw-sources.mjs'

test('parse la table des matières biblique d’un volume BC', () => {
  const pages = parseCommentaryToc({
    html: '<a href="/read/90.8" class="book-toc__link js-toc_e">Genesis</a><a href="/read/90.9" class="book-toc__link">Chapter 1</a>',
    bookId: 90,
    code: '1BC',
  })
  assert.deepEqual(pages, [{ bookId: 90, code: '1BC', pageId: '90.9', bookName: 'Genesis', chapter: 1 }])
})

test('parse la table des matières ECSI', () => {
  const pages = parseScriptureIndexToc('<a href="/read/14275.2" class="book-toc__link js-toc_e">Genesis</a><a href="/read/14275.3" class="book-toc__link">Genesis 1</a>')
  assert.deepEqual(pages, [{ bookId: 14275, code: 'ECSI', pageId: '14275.3', bookName: 'Genesis', chapter: 1 }])
})

test('extrait le commentaire EGW et ses sources originales', () => {
  const html = '<p class="para standard-indented" id="90.10"><span><strong><span class="egwlink egwlink_bible" title="Genesis 1:1" data-link="x">1-3</span>. Création</strong>—Texte (<span class="egwlink egwlink_book" title="Lt 131, 1897" data-link="14062.5131001">Letter 131</span>).</span><span class="refCode">1BC 1081.2</span></p>'
  const [entry] = parseCommentaryPage({ html, page: { code: '1BC', bookName: 'Genesis', chapter: 1 } })
  assert.equal(entry.passage, '1-1-1')
  assert.equal(entry.source.html.includes('class="ref"'), true)
  assert.equal(entry.source.html.includes('1BC 1081.2'), false)
  assert.deepEqual(entry.originalSources[0], { label: 'Lt 131, 1897', paragraphId: '14062.5131001', url: 'https://text.egwwritings.org/read/14062.5131001' })
})

test('extrait les associations ECSI et conserve les plages de versets', () => {
  const html = '<p id="14275.14" class="h4">6-9</p><p class="para standard-noindent" id="14275.15"><span><span class="egwlink egwlink_book" title="PP 44" data-link="84.3635">PP 44</span>; <span class="egwlink egwlink_book" title="PP 44" data-link="84.3635">PP 44</span></span></p>'
  const [entry] = parseScriptureIndexPage({ html, page: { pageId: '14275.3', bookName: 'Genesis', chapter: 1 } })
  assert.equal(entry.passage, '1-1-6')
  assert.equal(entry.passageEndVerse, 9)
  assert.equal(entry.citations.length, 1)
})

test('fusionne les deux couches sans confondre index et commentaire', () => {
  const merged = mergeEgwLayers({ commentary: [{ passage: '1-1-1', id: 'c' }], scriptureIndex: [{ passage: '1-1-1', id: 'i' }] })
  assert.equal(merged[0].curatedCommentary[0].id, 'c')
  assert.equal(merged[0].scriptureIndex[0].id, 'i')
})

test('extrait uniquement les paragraphes ECSI ciblés avec leur contexte documentaire', () => {
  const html = `
    <meta name="title" content="Patriarchs and Prophets">
    <meta name="keywords" content="PP">
    <a class="breadcrumbs-item" href="/book/b84">Patriarchs and Prophets</a>
    <a class="breadcrumbs-item" href="/read/84.117">Chapter 2—The Creation</a>
    <h1 class="breadcrumbs-header-title">Chapter 2—The Creation</h1>
    <p class="para" id="84.118"><span>Target <span class="egwlink egwlink_bible" title="Psalm 33:6">Psalm 33:6</span>.</span><span class="refCode">PP 44.1</span></p>
    <p class="para" id="84.119"><span>Neighbor.</span><span class="refCode">PP 44.2</span></p>`
  const paragraphs = parseIndexedParagraphPage({ html, targetParagraphIds: new Set(['84.118']) })
  assert.equal(paragraphs.length, 1)
  assert.equal(paragraphs[0].id, '84.118')
  assert.deepEqual(paragraphs[0].book, { id: '84', title: 'Patriarchs and Prophets', code: 'PP' })
  assert.deepEqual(paragraphs[0].section, {
    pageId: '84.117',
    title: 'Chapter 2—The Creation',
    contextUrl: 'https://text.egwwritings.org/read/84.118',
  })
  assert.equal(paragraphs[0].sourceReference, 'PP 44.1')
  assert.equal(paragraphs[0].source.html.includes('Neighbor'), false)
  assert.equal(paragraphs[0].source.html.includes('refCode'), false)
  assert.match(paragraphs[0].source.html, /class="bible-ref" data-reference-id="r1"/)
  assert.deepEqual(paragraphs[0].source.references, [{
    id: 'r1',
    kind: 'bible',
    osis: 'Ps.33.6',
    label: 'Psalm 33:6',
    source: 'source-marker',
    confidence: 'exact',
  }])
})

test('conserve le contexte d’une ancienne cible même lorsque son paragraphe exact a disparu', () => {
  const html = `
    <meta name="title" content="Letters and Manuscripts — Volume 12 (1897)">
    <meta name="keywords" content="12LtMs">
    <a class="breadcrumbs-item" href="/book/b14062">Letters and Manuscripts — Volume 12 (1897)</a>
    <a class="breadcrumbs-item" href="/read/14062.20090000">1897</a>
    <a class="breadcrumbs-item" href="/read/14062.20090816">Ms 177, 1897</a>
    <h1 class="breadcrumbs-header-title">Ms 177, 1897</h1>`
  assert.deepEqual(parseIndexedParagraphContext({ html, paragraphId: '14062.6124182' }), {
    book: { id: '14062', title: 'Letters and Manuscripts — Volume 12 (1897)', code: '12LtMs' },
    section: { pageId: '14062.20090816', title: 'Ms 177, 1897', contextUrl: 'https://text.egwwritings.org/read/14062.6124182' },
  })
})

test('retrouve toutes les sous-sections appartenant à un chapitre EGW', () => {
  const html = `
    <a href="/read/15.78" class="book-toc__link js-toc_e">Chapter 2</a>
    <ul class="book-toc__list book-toc__sublist">
      <li><a class="book-toc__link" href="/read/15.80">The Sower</a></li>
      <li><a href="/read/15.127" class="book-toc__link">The Soil</a></li>
    </ul>
    <a href="/read/15.221" class="book-toc__link">Chapter 3</a>`
  assert.deepEqual(parseBookTocSectionPages({ html, sectionPageId: '15.78' }), ['15.78', '15.80', '15.127'])
})

test('remplace un marqueur éditorial par les vrais paragraphes de son chapitre', () => {
  const context = {
    book: { id: '84', title: 'Patriarchs and Prophets', code: 'PP' },
    section: { pageId: '84.117', title: 'Chapter 2—The Creation', contextUrl: 'https://text.egwwritings.org/read/84.3635' },
  }
  const paragraphs = parseIndexedSectionPage({
    html: `
      <p class="para bibletext" id="84.3635">This chapter is based on Genesis 1 and 2.</p>
      <p class="para standard-indented" id="84.118"><span>Creation.</span><span class="refCode">PP 44.1</span></p>`,
    context,
    markerParagraphId: '84.3635',
    markerText: 'This chapter is based on Genesis 1 and 2.',
  })
  assert.equal(paragraphs.length, 1)
  assert.equal(paragraphs[0].id, '84.118')
  assert.equal(paragraphs[0].chapterAssociation.markerParagraphId, '84.3635')
  assert.equal(paragraphs[0].section.pageId, '84.117')
})

test('interprète la portée biblique déclarée par un marqueur de chapitre', () => {
  const scope = parseChapterAssociationScriptureScope(
    'This chapter is based on Jonah 1 to 4.'
  )
  assert.deepEqual(scope, { label: 'Jonah 1 to 4', osis: 'Jonah' })
  assert.equal(scriptureScopeCoversPassage(scope.osis, '32-1-1'), true)
  assert.equal(scriptureScopeCoversPassage(scope.osis, '32-4-11'), true)
  assert.equal(scriptureScopeCoversPassage(scope.osis, '31-1-1'), false)
})

test('remplace une ancre de section sans référence par le contenu complet de sa page', () => {
  const html = `
    <p class="para devotionaltext" id="17.1781"><span>Jonah</span><span class="refCode"></span></p>
    <p class="para" id="17.1782"><span>First paragraph.</span><span class="refCode">CC 230.1</span></p>
    <p class="para" id="17.1783"><span>Second paragraph.</span><span class="refCode">CC 230.2</span></p>`
  const context = {
    book: { id: '17', title: 'Conflict and Courage', code: 'CC' },
    section: {
      pageId: '17.1780',
      title: 'Reluctant Prophet, August 12',
      contextUrl: 'https://text.egwwritings.org/read/17.1781',
    },
  }
  assert.equal(isIndexedSectionAnchor({ html, targetParagraphId: '17.1781' }), true)
  assert.deepEqual(
    parseIndexedHeadingSectionPage({ html, context, anchorParagraphId: '17.1781' })
      .map(paragraph => paragraph.sourceReference),
    ['CC 230.1', 'CC 230.2']
  )
})

test('ne confond pas une citation biblique isolée avec une ancre de section', () => {
  const html = '<p class="para introquote" id="115.326"><span>“The Lord gave the word: great was the company of those that published it.” <span class="egwlink egwlink_bible">Psalm 68:11</span>.</span></p>'
  assert.equal(isIndexedSectionAnchor({ html, targetParagraphId: '115.326' }), false)
})

test('supprime le contenu actif du HTML EGW', () => {
  assert.equal(normalizeEgwMarkup('<span>Bon<script>alert(1)</script><iframe>non</iframe></span>'), '<span>Bon</span>')
})

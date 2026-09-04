/* eslint-disable @typescript-eslint/no-require-imports */
const {
  APP_BOOK_IDS,
  addParsedPage,
  buildSourcePages,
  createCanonicalBible,
  parseTheotexChapter,
  validateBiblePair,
} = require('../../../scripts/lib/theotexSeptuagint.cjs')

describe('ThéoTeX Septuagint generator', () => {
  const html = `
    <table>
      <tr><td><div class="num">1a</div></td><td><div class="vg">Ἐν ἀρχῇ.</div></td><td><div class="vf">Au commencement.</div></td></tr>
      <tr><td><div class="num">1b</div></td><td><div class="vg">Καὶ φῶς.</div></td><td><div class="vf">Et la lumière.</div></td></tr>
      <tr><td><div class="num">2</div></td><td><div class="vg">δεύτερον<br>μέρος.</div></td><td><div class="vf">Deuxième&nbsp;partie.</div></td></tr>
    </table>`

  it('extracts the parallel texts and folds alphanumeric additions into numeric verse keys', () => {
    expect(parseTheotexChapter(html)).toEqual({
      greek: { 1: '(a) Ἐν ἀρχῇ. (b) Καὶ φῶς.', 2: 'δεύτερον μέρος.' },
      french: { 1: '(a) Au commencement. (b) Et la lumière.', 2: 'Deuxième partie.' },
    })
  })

  it('recognizes a source suffix printed at the start of the Greek text', () => {
    const duplicateNumberHtml = `
      <table>
        <tr><td><div class="num">29</div></td><td><div class="vg">πρῶτον.</div></td><td><div class="vf">Premier.</div></td></tr>
        <tr><td><div class="num">29</div></td><td><div class="vg">a δεύτερον.</div></td><td><div class="vf">Deuxième.</div></td></tr>
      </table>`
    expect(parseTheotexChapter(duplicateNumberHtml)).toEqual({
      greek: { 29: 'πρῶτον. (a) δεύτερον.' },
      french: { 29: 'Premier. (a) Deuxième.' },
    })
  })

  it('keeps a bridged source verse on its first numeric key', () => {
    const bridgeHtml = `
      <table><tr><td><div class="num">1-2</div></td><td><div class="vg">κείμενον.</div></td><td><div class="vf">Texte.</div></td></tr></table>`
    expect(parseTheotexChapter(bridgeHtml)).toEqual({
      greek: { 1: '(1-2) κείμενον.' },
      french: { 1: '(1-2) Texte.' },
    })
  })

  it('maps the Catholic canon and additions to stable Bible Strong identities', () => {
    const pages = buildSourcePages('https://example.test')
    expect(APP_BOOK_IDS).toEqual([
      ...Array.from({ length: 39 }, (_, index) => index + 1),
      67,
      68,
      69,
      70,
      71,
      72,
      73,
      74,
      75,
      76,
      77,
    ])
    expect(pages).toHaveLength(1122)
    expect(
      pages.find((page: { url: string }) => page.url.endsWith('/2esdras/2esdras_11.html'))
    ).toMatchObject({
      book: 16,
      targetChapter: 1,
    })
    expect(
      pages.find((page: { url: string }) => page.url.includes('/lettre_jeremie/'))
    ).toMatchObject({
      book: 71,
      targetChapter: 6,
    })
    expect(
      pages.find((page: { url: string }) => page.url.includes('/suzanne_theod/'))
    ).toMatchObject({
      book: 27,
      targetChapter: 13,
    })
    expect(pages.find((page: { url: string }) => page.url.includes('/bel_theod/'))).toMatchObject({
      book: 27,
      targetChapter: 14,
    })
    expect(pages.find((page: { url: string }) => page.url.includes('/1esdras/'))).toMatchObject({
      book: 74,
    })
    expect(pages.find((page: { url: string }) => page.url.includes('/3maccabees/'))).toMatchObject({
      book: 75,
    })
    expect(pages.find((page: { url: string }) => page.url.includes('/4maccabees/'))).toMatchObject({
      book: 76,
    })
    expect(
      pages.find((page: { url: string }) => page.url.includes('/salomon_psaumes/'))
    ).toMatchObject({ book: 77 })
    expect(pages.some((page: { url: string }) => page.url.endsWith('/siracide_52.html'))).toBe(true)
  })

  it('builds paired artifacts and rejects coverage differences', () => {
    const bibles = { greek: {}, french: {} }
    addParsedPage(bibles, { book: 1, targetChapter: 1 }, parseTheotexChapter(html))
    expect(() => validateBiblePair(bibles.greek, bibles.french)).toThrow(/Book IDs differ/)

    const completeGreek = Object.fromEntries(
      APP_BOOK_IDS.map((book: number) => [book, { 1: { 1: `Greek ${book}` } }])
    )
    const completeFrench = Object.fromEntries(
      APP_BOOK_IDS.map((book: number) => [book, { 1: { 1: `French ${book}` } }])
    )
    expect(validateBiblePair(completeGreek, completeFrench)).toMatchObject({
      bookCount: 50,
      chapterCount: 50,
      verseCount: 50,
    })
    delete completeFrench[77][1][1]
    expect(() => validateBiblePair(completeGreek, completeFrench)).toThrow(/coverage differs/)
  })

  it('allows the source superscription numbered as Lamentations 1:0', () => {
    const completeGreek = Object.fromEntries(
      APP_BOOK_IDS.map((book: number) => [book, { 1: { 1: `Greek ${book}` } }])
    )
    const completeFrench = Object.fromEntries(
      APP_BOOK_IDS.map((book: number) => [book, { 1: { 1: `French ${book}` } }])
    )
    completeGreek[25][1] = { 0: 'Greek superscription', 1: 'Greek 25' }
    completeFrench[25][1] = { 0: 'French superscription', 1: 'French 25' }

    expect(() => validateBiblePair(completeGreek, completeFrench)).not.toThrow()
  })

  it('builds the canonical V4 LXX payload without changing the legacy text', () => {
    const legacy = {
      1: { 1: { 1: 'Ἐν ἀρχῇ.' } },
      25: { 1: { 0: 'Καὶ ἐγένετο.' } },
    }
    const canonical = createCanonicalBible(legacy, 'source-sha')

    expect(canonical).toMatchObject({
      format: 'bible-strong-canonical-bible',
      schemaVersion: 4,
      applicationVersionId: 'LXX',
      datasetId: 'LXX',
      sourceVersion: 'RAHLFS-THEOTEX',
      textRevision: expect.stringMatching(/^lxx-[0-9a-f]{20}$/),
      textSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      sourceSha256: 'source-sha',
      verseCount: 2,
      noteCount: 0,
      headingCount: 0,
    })
    expect(canonical.verses[1][1][1]).toEqual({
      text: 'Ἐν ἀρχῇ.',
      startTags: [],
      layout: [],
      notes: [],
      headings: [],
    })
    expect(canonical.verses[25][1][0].text).toBe('Καὶ ἐγένετο.')
    expect(createCanonicalBible(legacy, 'source-sha').textSha256).toBe(canonical.textSha256)
  })
})

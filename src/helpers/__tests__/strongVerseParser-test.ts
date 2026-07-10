import { parseStrongVerse } from '../strongVerseParser'

const MATTHEW_14_33 =
  '1161 Ceux qui étaient dans 1722 la barque 4143 vinrent 2064 (5631) se prosterner devant 4352 (5656) Jésus 846, et dirent 3004 (5723) : Tu es 1488 (5748) véritablement 230 le Fils 5207 de Dieu 2316. '

const MATTHEW_14_33_VISIBLE =
  'Ceux qui étaient dans la barque vinrent se prosterner devant Jésus, et dirent : Tu es véritablement le Fils de Dieu. '

const GENESIS_1_1 =
  'Au commencement 07225, Dieu 0430 créa 01254 (8804) 0853 les cieux 08064 0853 et la terre 0776.'

const GENESIS_1_1_VISIBLE = 'Au commencement, Dieu créa les cieux et la terre.'

type ParsedStrongVerse = ReturnType<typeof parseStrongVerse>

const reconstructVisibleText = (model: ParsedStrongVerse) =>
  model.runs.map(run => (run.type === 'standalone' ? '' : run.text)).join('')

const getOccurrence = (model: ParsedStrongVerse, reference: string) => {
  const occurrence = model.occurrences.find(item => item.reference === reference)

  expect(occurrence).toBeDefined()
  return occurrence!
}

const expectSurfaceRun = (
  model: ParsedStrongVerse,
  reference: string,
  text: string,
  morphology: string[] = []
) => {
  const occurrence = getOccurrence(model, reference)

  expect(occurrence).toEqual(
    expect.objectContaining({
      reference,
      morphology,
      alignment: expect.objectContaining({ kind: 'surface' }),
    })
  )
  expect(model.runs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: 'lexical',
        text,
        reference,
        occurrenceId: occurrence.id,
      }),
    ])
  )
}

describe('parseStrongVerse', () => {
  it('aligns the exact Matthew 14:33 Greek fixture without losing visible text', () => {
    const model = parseStrongVerse(MATTHEW_14_33, 40, [
      { Code: '1161', LSG: 'mais, et, maintenant, alors, aussi, néanmoins' },
      { Code: 1722, LSG: 'à, au, en, avec, parmi, sur, à travers' },
      { Code: 4143, LSG: 'barque, navire, bâtiment' },
      { Code: 2064, LSG: 'venir, aller, arriver, entrer, se rendre, être' },
      { Code: 4352, LSG: 'adorer; se prosterner devant; rendre hommage' },
      { Code: 846, LSG: 'lui, les, eux, ses, il, elle' },
      { Code: 3004, LSG: 'dire, dit, appelé, annoncé, déclarer, répondre' },
      { Code: '1488', LSG: 'être; Tu es' },
      { Code: 230, LSG: 'vraiment, véritablement, certainement, en vérité' },
      { Code: 5207, LSG: 'fils, le fils (de Dieu, de David), les enfants' },
      { Code: 2316, LSG: 'Dieu, dieux, Seigneur, Christ, non traduit' },
    ])

    expect(model.visibleText).toBe(MATTHEW_14_33_VISIBLE)
    expect(reconstructVisibleText(model)).toBe(MATTHEW_14_33_VISIBLE)
    expect(model.runs.filter(run => run.type === 'lexical').every(run => run.text.length > 0)).toBe(
      true
    )

    const prefixOccurrence = getOccurrence(model, '1161')
    expect(prefixOccurrence).toEqual(
      expect.objectContaining({
        family: 'greek',
        rawReference: '1161',
        reference: '1161',
        morphology: [],
        alignment: { kind: 'unaligned' },
      })
    )
    expect(model.runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'standalone',
          reference: '1161',
          occurrenceId: prefixOccurrence.id,
        }),
      ])
    )

    expectSurfaceRun(model, '1722', 'dans')
    expectSurfaceRun(model, '4143', 'barque')
    expectSurfaceRun(model, '2064', 'vinrent', ['5631'])
    expectSurfaceRun(model, '4352', 'se prosterner devant', ['5656'])
    expectSurfaceRun(model, '846', 'Jésus')
    expectSurfaceRun(model, '3004', 'dirent', ['5723'])
    expectSurfaceRun(model, '1488', 'Tu es', ['5748'])
    expectSurfaceRun(model, '230', 'véritablement')
    expectSurfaceRun(model, '5207', 'le Fils')
    expectSurfaceRun(model, '2316', 'Dieu')

    expect(model.morphology).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: '5631',
          lexicalOccurrenceId: getOccurrence(model, '2064').id,
        }),
        expect.objectContaining({
          reference: '5656',
          lexicalOccurrenceId: getOccurrence(model, '4352').id,
        }),
      ])
    )
    expect(model.references).toEqual([
      '1161',
      '1722',
      '4143',
      '2064',
      '4352',
      '846',
      '3004',
      '1488',
      '230',
      '5207',
      '2316',
    ])
  })

  it('keeps both untranslated Hebrew object markers standalone and deduplicates references', () => {
    const model = parseStrongVerse(GENESIS_1_1, 1, [
      { Code: 7225, LSG: "commencement, prémices, d'abord, première" },
      { Code: 430, LSG: 'Dieu, dieux, éternel' },
      { Code: 1254, LSG: 'créer, créateur, auteur, faire' },
      { Code: '0853', LSG: 'non traduit' },
      { Code: 8064, LSG: 'les cieux, le ciel, au dessous du ciel' },
      { Code: 776, LSG: 'terre(s), pays, contrée, terrain, sol' },
    ])

    expect(model.visibleText).toBe(GENESIS_1_1_VISIBLE)
    expect(reconstructVisibleText(model)).toBe(GENESIS_1_1_VISIBLE)

    const objectMarkerOccurrences = model.occurrences.filter(
      occurrence => occurrence.reference === '853'
    )
    expect(objectMarkerOccurrences).toHaveLength(2)
    objectMarkerOccurrences.forEach(occurrence => {
      expect(occurrence).toEqual(
        expect.objectContaining({
          family: 'hebrew',
          rawReference: '0853',
          reference: '853',
          morphology: [],
          alignment: { kind: 'unaligned' },
        })
      )
    })

    expect(
      model.runs.filter(run => run.type === 'standalone' && run.reference === '853')
    ).toHaveLength(2)
    expect(getOccurrence(model, '1254').morphology).toEqual(['8804'])
    expectSurfaceRun(model, '7225', 'commencement')
    expectSurfaceRun(model, '430', 'Dieu')
    expectSurfaceRun(model, '1254', 'créa', ['8804'])
    expectSurfaceRun(model, '8064', 'les cieux')
    expectSurfaceRun(model, '776', 'terre')
    expect(model.references).toEqual(['7225', '430', '1254', '853', '8064', '776'])
  })

  it('prefers a preceding translated surface over a coincidental forward alias', () => {
    const names = parseStrongVerse('L’Éternel 03068 Dieu 0430 fit 06213', 1, [
      { Code: 3068, LSG: 'éternel, Dieu' },
      { Code: 430, LSG: 'Dieu' },
    ])
    const inflection = parseStrongVerse('se leva 07925 de bon matin', 1, [
      { Code: 7925, LSG: 'se lever; de (bon matin, tôt)' },
    ])

    expectSurfaceRun(names, '3068', 'L’Éternel')
    expectSurfaceRun(names, '430', 'Dieu')
    expectSurfaceRun(inflection, '7925', 'leva')
  })

  it('normalizes competing references so only one occurrence owns a visible surface', () => {
    const model = parseStrongVerse('soixante-quinze 07657 08141 02568 ans 08141', 1, [
      { Code: 7657, LSG: 'soixante-dix, soixante-quatorze' },
      { Code: 8141, LSG: 'années, ans, ...; 875' },
      { Code: 2568, LSG: 'cinq, cinquième, quinze, quinzième' },
    ])
    const yearOccurrences = model.occurrences.filter(occurrence => occurrence.reference === '8141')

    expect(yearOccurrences).toHaveLength(2)
    expect(yearOccurrences[0].alignment).toEqual(
      expect.objectContaining({ kind: 'surface', affinity: 'prefix' })
    )
    expect(yearOccurrences[1].alignment).toEqual({ kind: 'unaligned' })
    expect(model.runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'lexical', text: 'ans', reference: '8141' }),
        expect.objectContaining({
          type: 'standalone',
          reference: '8141',
          occurrenceId: yearOccurrences[1].id,
        }),
      ])
    )
    expect(reconstructVisibleText(model)).toBe('soixante-quinze ans')
  })

  it('reconstructs an apostrophe split by lexical annotations', () => {
    const model = parseStrongVerse('j 3165’aille 2064 (5629).', 40)

    expect(model.visibleText).toBe('j’aille.')
    expect(reconstructVisibleText(model)).toBe('j’aille.')
    expectSurfaceRun(model, '3165', 'j')
    expectSurfaceRun(model, '2064', 'aille', ['5629'])
    expect(model.references).toEqual(['3165', '2064'])
  })

  it('keeps decimal verse labels visible while separating morphology annotations', () => {
    const model = parseStrongVerse('Voir (14.1) se prosterner 4352 (5656).', 40, [
      { Code: 4352, LSG: 'se prosterner' },
    ])

    expect(model.visibleText).toBe('Voir (14.1) se prosterner.')
    expect(reconstructVisibleText(model)).toBe('Voir (14.1) se prosterner.')
    expectSurfaceRun(model, '4352', 'se prosterner', ['5656'])
    expect(model.morphology).toEqual([
      expect.objectContaining({
        reference: '5656',
        lexicalOccurrenceId: getOccurrence(model, '4352').id,
      }),
    ])
    expect(model.references).toEqual(['4352'])
  })

  it('recognizes morphology joined directly to its lexical reference', () => {
    const model = parseStrongVerse('n’ira 03212(8799) pas', 7, [
      { Code: 3212, LSG: 'aller, venir, marcher' },
    ])

    expect(model.visibleText).toBe('n’ira pas')
    expect(reconstructVisibleText(model)).toBe('n’ira pas')
    expectSurfaceRun(model, '3212', 'n’ira', ['8799'])
    expect(model.morphology).toEqual([
      expect.objectContaining({
        reference: '8799',
        lexicalOccurrenceId: getOccurrence(model, '3212').id,
      }),
    ])
    expect(model.references).toEqual(['3212'])
  })

  it('removes overlapping annotation whitespace when a lexical marker starts the verse', () => {
    const model = parseStrongVerse('03212 (8799) aller', 7, [{ Code: 3212, LSG: 'aller' }])

    expect(model.visibleText).toBe('aller')
    expectSurfaceRun(model, '3212', 'aller', ['8799'])
  })

  it('removes references joined to adjacent words without collapsing their spaces', () => {
    const model = parseStrongVerse('n’ayez 5399pas 3361 peur 5399 (5737)', 40)

    expect(model.visibleText).toBe('n’ayez pas peur')
    expect(reconstructVisibleText(model)).toBe('n’ayez pas peur')
    expect(model.visibleText).not.toMatch(/\d/u)
    expect(model.occurrences.map(occurrence => occurrence.reference)).toEqual([
      '5399',
      '3361',
      '5399',
    ])
    expect(model.occurrences[2]).toEqual(
      expect.objectContaining({
        morphology: ['5737'],
      })
    )
    expect(model.morphology).toEqual([
      expect.objectContaining({
        reference: '5737',
        lexicalOccurrenceId: model.occurrences[2].id,
      }),
    ])
    expect(model.references).toEqual(['5399', '3361'])
  })

  it.each([
    {
      label: 'a hyphenated name',
      source: 'Ben-01121 Hinnom',
      book: 6,
      visibleText: 'Ben-Hinnom',
      rawReference: '01121',
      reference: '1121',
    },
    {
      label: 'an apostrophe contraction',
      source: 'j’1473 aime',
      book: 64,
      visibleText: 'j’aime',
      rawReference: '1473',
      reference: '1473',
    },
  ])('reconstructs $label split by an inline reference', fixture => {
    const model = parseStrongVerse(fixture.source, fixture.book)

    expect(model.visibleText).toBe(fixture.visibleText)
    expect(reconstructVisibleText(model)).toBe(fixture.visibleText)
    expect(model.occurrences).toEqual([
      expect.objectContaining({
        rawReference: fixture.rawReference,
        reference: fixture.reference,
      }),
    ])
    expect(model.references).toEqual([fixture.reference])
  })

  it.each([
    ['ce qu 0834 ’est devenu', 1, 'ce qu’est devenu'],
    ['Jésus 2424 -Christ 5547', 40, 'Jésus-Christ'],
  ])('removes annotation spaces before a translated joiner in %s', (source, book, visibleText) => {
    const model = parseStrongVerse(source, book)

    expect(model.visibleText).toBe(visibleText)
    expect(reconstructVisibleText(model)).toBe(visibleText)
  })

  it('preserves punctuation immediately following references', () => {
    const model = parseStrongVerse('Dieu 02316,Jésus 0846.', 40)

    expect(model.visibleText).toBe('Dieu,Jésus.')
    expect(reconstructVisibleText(model)).toBe('Dieu,Jésus.')
    expectSurfaceRun(model, '2316', 'Dieu')
    expectSurfaceRun(model, '846', 'Jésus')
    expect(model.references).toEqual(['2316', '846'])
  })

  it('separates concatenated references and removes a zero-valued annotation artifact', () => {
    const concatenated = parseStrongVerse('ils ne saisissaient 30041097 (5707) pas', 42)
    const unevenConcatenation = parseStrongVerse('il se remit 3773825 à table 377 (5631)', 43)
    const zeroArtifact = parseStrongVerse('Mettez 8731211 0-moi à part', 44)

    expect(concatenated.visibleText).toBe('ils ne saisissaient pas')
    expect(concatenated.references).toEqual(['3004', '1097'])
    expect(concatenated.morphology).toEqual([
      expect.objectContaining({
        reference: '5707',
        lexicalOccurrenceId: getOccurrence(concatenated, '1097').id,
      }),
    ])

    expect(unevenConcatenation.visibleText).toBe('il se remit à table')
    expect(unevenConcatenation.references).toEqual(['377', '3825'])

    expect(zeroArtifact.visibleText).toBe('Mettez-moi à part')
    expect(zeroArtifact.references).toEqual(['873', '1211'])
  })
})

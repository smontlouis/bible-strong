import { COMMENTARY_CATALOG } from '@bible-strong/resource-catalog/commentaries'
import { describe, expect, it } from 'vitest'
import {
  findCommentary,
  findCommentaryCounterpart,
  listCommentaries,
  listCommentaryProjections,
  localizeCommentaryRights,
} from './commentaryCatalog'
import { isCommentaryResourceSlug } from './commentaryRoutes'

describe('Commentary catalog', () => {
  it('lists the commentaries of a language in catalog order', () => {
    const french = listCommentaries('fr').map(commentary => commentary.id)
    expect(french).toEqual(
      COMMENTARY_CATALOG.filter(entry => (entry.languages as readonly string[]).includes('fr')).map(
        entry => entry.id
      )
    )
    expect(french).toContain('mhy-fr')
    expect(french).not.toContain('mhcc')
    expect(listCommentaryProjections()).toHaveLength(
      COMMENTARY_CATALOG.reduce((total, entry) => total + entry.languages.length, 0)
    )
  })

  it('finds a commentary by its Resource identity, in a language it is published in', () => {
    expect(findCommentary('fr', 'mhy-fr')).toMatchObject({ id: 'mhy-fr', publicationId: 'MHY' })
    expect(findCommentary('en', 'mhy-fr')).toBeUndefined()
    expect(findCommentary('fr', 'MHY')).toBeUndefined()
    expect(findCommentary('fr', undefined)).toBeUndefined()
  })

  it('pairs a commentary with the same work in the other language', () => {
    // One identity published in both languages.
    expect(findCommentaryCounterpart(findCommentary('fr', 'barnes')!, 'fr')?.id).toBe('barnes')
    // One work listed as an edition per language.
    expect(findCommentaryCounterpart(findCommentary('fr', 'mhy-fr')!, 'fr')?.id).toBe('mhcc')
    expect(findCommentaryCounterpart(findCommentary('en', 'mhcc')!, 'en')?.id).toBe('mhy-fr')
    expect(findCommentaryCounterpart(findCommentary('en', 'calvin')!, 'en')).toBeUndefined()
    // A counterpart is published in the other language and pairs back.
    for (const { language, commentary } of listCommentaryProjections()) {
      const counterpart = findCommentaryCounterpart(commentary, language)
      if (commentary.counterpartId) expect(counterpart).toBeDefined()
      if (counterpart) expect(counterpart.counterpartId).toBe(commentary.id)
    }
  })

  it('addresses every commentary with a segment of the route grammar', () => {
    for (const entry of COMMENTARY_CATALOG) expect(isCommentaryResourceSlug(entry.id)).toBe(true)
  })

  it('describes a commentary in the language of the page', () => {
    expect(findCommentary('fr', 'acbc')?.description).toMatch(/^Commentaire méthodiste/u)
    expect(findCommentary('en', 'acbc')?.description).toMatch(/^A Methodist commentary/u)
    for (const { commentary } of listCommentaryProjections()) {
      expect(commentary.description).not.toBe('')
    }
  })

  it('names authors in English on English pages', () => {
    expect(findCommentary('en', 'calvin')?.author).toBe('John Calvin')
    expect(findCommentary('fr', 'sdabc')?.author).toBe('Francis D. Nichol (dir.) et contributeurs')
    expect(findCommentary('en', 'sdabc')?.author).toBe('Francis D. Nichol (ed.) and contributors')
    // A French turn of phrase in a new catalog entry needs its English name here.
    for (const commentary of listCommentaries('en')) {
      expect(commentary.author).not.toMatch(
        / et |d’|\(dir\.\)|compilateur|collaborateurs|contributeurs|Traducteurs|Collège|adaptation|^Jean |^Rachi$/u
      )
    }
  })

  it('writes the attribution of the catalog in the language of the page', () => {
    expect(localizeCommentaryRights('Domaine public', 'fr')).toBe('Domaine public')
    expect(localizeCommentaryRights('Domaine public', 'en')).toBe('Public domain')
    expect(findCommentary('en', 'king-comments')?.rights).toBe('© Ger de Koning · all rights reserved')
    expect(findCommentary('fr', 'mhy-fr')?.rights).toBe(
      '© Éditions CLÉ / Dominique Osché · tous droits réservés'
    )
    expect(findCommentary('en', 'mhm')?.rights).toBe('STEPBible · CC BY 4.0')
    for (const commentary of listCommentaries('en')) {
      expect(commentary.rights).not.toMatch(/Domaine|réservés/u)
    }
  })
})

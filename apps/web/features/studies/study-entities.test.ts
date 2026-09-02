import { describe, expect, it } from 'vitest'
import {
  getStudyEntityInlineAttributes,
  getStudyEntityInlineClasses,
  getStudyEntityLink,
  renderStudyEntityBlock,
  studyEntityTypes,
  type StudyEntityEmbedPayload,
  type StudyEntityType,
} from './study-entities'
import { convertStudyOpsToHtml } from './helpers.study'

const createPayload = (
  type: StudyEntityType,
  endpoint: Record<string, unknown> = {},
): StudyEntityEmbedPayload => ({
  schemaVersion: 1,
  endpoint: { type, ...endpoint },
  fallback: { typeLabel: type, title: `Fallback ${type}` },
  display: {
    typeLabel: type,
    title: `Titre ${type}`,
    subtitle: 'Sous-titre',
    description: 'Description détaillée',
    chip: 'Repère',
  },
})

describe('published study entity rendering', () => {
  it.each(studyEntityTypes)('renders the %s block instead of its raw blot name', type => {
    const html = renderStudyEntityBlock(createPayload(type))

    expect(html).toContain(`block-entity--${type}`)
    expect(html).toContain(`Titre ${type}`)
    expect(html).not.toContain('&lt;block-entity&gt;')
  })

  it('links published study and safe external-link references', () => {
    expect(getStudyEntityLink(createPayload('study', { studyId: 'study/one' }))).toEqual({
      href: '/studies/study%2Fone',
    })
    expect(getStudyEntityLink(createPayload('externalLink', { url: 'https://example.com/' }))).toEqual({
      href: 'https://example.com/',
      external: true,
    })
  })

  it('does not turn unsafe external protocols into links', () => {
    const html = renderStudyEntityBlock(
      createPayload('externalLink', { url: 'javascript:alert(1)' }),
    )

    expect(html).toContain('<button')
    expect(html).not.toContain('href=')
  })

  it('escapes display data before adding it to study HTML', () => {
    const payload = createPayload('annotation')
    payload.display.title = '<img src=x onerror=alert(1)>'

    const html = renderStudyEntityBlock(payload)

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<img')
  })

  it('decodes legacy HTML entities while keeping their result escaped', () => {
    const payload = createPayload('annotation')
    payload.display.description = 'serviteur de N&#xE9;bo &amp; ami &lt;fidèle&gt;'

    const html = renderStudyEntityBlock(payload)

    expect(html).not.toContain('&#xE9;')
    expect(html).toContain('Nébo &amp; ami &lt;fidèle&gt;')
  })

  it('falls back gracefully when an embed is malformed', () => {
    expect(renderStudyEntityBlock({ schemaVersion: 99 })).toContain('Référence indisponible')
  })

  it('adds semantic metadata and links to inline entities', () => {
    const payload = createPayload('externalLink', { url: 'https://example.com/' })
    const operation = { attributes: { 'inline-entity': payload } }

    expect(getStudyEntityInlineAttributes(operation)).toMatchObject({
      title: 'externalLink — Titre externalLink',
      'data-entity-type': 'externalLink',
      type: 'button',
    })
    expect(decodeURIComponent(getStudyEntityInlineAttributes(operation)['data-study-entity'])).toContain(
      'externalLink',
    )
    expect(getStudyEntityInlineClasses(operation)).toEqual([
      'inline-entity',
      'inline-entity--externalLink',
    ])
  })

  it('integrates block and inline entities into the Quill conversion pipeline', () => {
    const dictionary = createPayload('dictionary', { word: 'Grâce' })
    const nave = createPayload('nave', { nameLower: 'grace' })

    const html = convertStudyOpsToHtml([
      { insert: 'Grâce', attributes: { 'inline-entity': dictionary } },
      { insert: '\n' },
      { insert: { 'block-entity': nave } },
      { insert: '\n' },
    ])

    expect(html).toContain('class="inline-entity inline-entity--dictionary"')
    expect(html).toContain('data-entity-type="dictionary"')
    expect(html).toContain('class="block-entity block-entity--nave"')
    expect(html).not.toContain('<div>block-entity</div>')
  })
})

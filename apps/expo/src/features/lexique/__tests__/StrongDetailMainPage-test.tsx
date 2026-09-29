import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { getDefaultStore } from 'jotai/vanilla'
import StrongDetailMainPage from '../StrongDetailMainPage'
import { strongDefinitionLevelAtom } from '../atoms'
import equivalences from './fixtures/strongDefinitionEquivalences.json'

jest.mock('react-native', () => ({ ScrollView: 'ScrollView' }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}))
jest.mock('~themes/ThemeProvider', () => ({ useTheme: () => ({}) }))
jest.mock('~themes/colorValues', () => ({
  resolveThemeColor: () => '#fff',
  colorWithOpacity: () => '#fff',
}))
jest.mock('~common/HorizontalControlScrollView', () => 'HorizontalScrollView')
jest.mock('~common/ui/PageContent', () => 'PageContent')
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  HStack: 'HStack',
  VStack: 'VStack',
  TouchableBox: 'TouchableBox',
}))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'FeatherIcon' }))
jest.mock('~common/Loading', () => 'Loading')
jest.mock('~features/bible/ConcordanceVerse', () => 'ConcordanceVerse')
jest.mock('~features/bible/ListenStrong', () => ({
  __esModule: true,
  default: 'ListenStrong',
  hasStrongAudio: () => false,
}))
jest.mock('../atoms', () => ({
  strongDefinitionLevelAtom: jest
    .requireActual<typeof import('jotai/vanilla')>('jotai/vanilla')
    .atom('essential'),
}))
jest.mock('../StrongEntryMetadata', () => 'StrongEntryMetadata')
jest.mock('../StrongEntityRelationGraph', () => ({
  StrongEntityRelationGraph: 'StrongEntityRelationGraph',
}))
jest.mock('../StrongPassageMediaSection', () => 'StrongPassageMediaSection')
jest.mock('../StrongDetailUI', () => ({
  StrongEditorialHtml: 'StrongEditorialHtml',
  StrongEditorialPreview: 'StrongEditorialPreview',
  StrongEditorialSection: ({
    title,
    children,
    expanded,
    onToggle,
    ...rest
  }: React.ComponentProps<typeof import('../StrongDetailUI').StrongEditorialSection>) => {
    const React = jest.requireActual<typeof import('react')>('react')
    return React.createElement(
      'StrongEditorialSection',
      { title, ...rest },
      onToggle &&
        React.createElement('TouchableBox', {
          accessibilityLabel: title,
          accessibilityState: { expanded },
          onPress: onToggle,
        }),
      (!onToggle || expanded) && children
    )
  },
  StrongEyebrow: 'StrongEyebrow',
  StrongLevelSwitch: 'StrongLevelSwitch',
  StrongEntityRelationList: 'StrongEntityRelationList',
  StrongEntitySummaryCard: 'StrongEntitySummaryCard',
  StrongLexicalRelationCard: 'StrongLexicalRelationCard',
  StrongPreviewLink: 'StrongPreviewLink',
}))

type Props = React.ComponentProps<typeof StrongDetailMainPage>
const noop = () => {}
const props: Props = {
  entry: {
    id: 266,
    selectedIdentity: { kind: 'dstrong', code: 'G0266' },
    stepCode: 'G0266',
    classicStrong: 'G0266',
    eStrong: 'G0266',
    dStrong: 'G0266',
    language: 'greek',
    baseCode: 266,
    original: 'ἁμαρτία',
    transliteration: 'hamartia',
    gloss: 'sin',
    relations: [],
    resources: [],
    lsjAbsent: false,
    modules: {
      resources: { moduleId: 'resources', status: 'missing' },
      entities: { moduleId: 'entities', status: 'missing' },
    },
  },
  passageMedia: [],
  concordanceVersion: 'KJV',
  concordanceVerses: [],
  concordanceLoading: true,
  concordanceError: false,
  concordanceRetrying: false,
  lemmaStats: [],
  readingTypography: { fontSizeScale: 0, lineHeight: 'normal' },
  onSelectLemma: noop,
  onOpenPage: noop,
  onOpenStrong: noop,
  onOpenBibleReference: noop,
  onOpenConcordanceVerse: noop,
  onOpenEntityProfile: noop,
  onOpenEntityRelation: noop,
  onRetryConcordance: noop,
}
let tree: ReactTestRenderer
beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})
beforeEach(() => {
  getDefaultStore().set(strongDefinitionLevelAtom, 'essential')
})
afterEach(() => {
  act(() => tree?.unmount())
})
const render = (overrides: Partial<Props> = {}) => {
  act(() => {
    tree = create(<StrongDetailMainPage {...props} {...overrides} />)
  })
  return tree.root
}
const definitions = (root: ReactTestRenderer['root']) =>
  root.findAll(node => String(node.type) === 'StrongEditorialHtml').map(node => node.props.value)
const levelSwitch = (root: ReactTestRenderer['root']) =>
  root.findAll(node => String(node.type) === 'StrongLevelSwitch')
const blockTitles = (root: ReactTestRenderer['root']) =>
  root
    .findAll(
      node => String(node.type) === 'Text' && node.props.className === 'font-bold text-[15px]'
    )
    .map(node => node.props.children)
const selectLevel = (root: ReactTestRenderer['root'], level: 'essential' | 'deep') =>
  act(() => levelSwitch(root)[0].props.onChange(level))

it('starts with the historical definition and reveals STEP at the deep level', () => {
  const simple = '<p>Historical definition</p>'
  const detailed = '<p>STEP definition</p>'
  const root = render({
    entry: { ...props.entry, definitionHtml: simple, detailedDefinitionHtml: detailed },
  })
  expect(definitions(root)).toEqual([simple])
  expect(levelSwitch(root)[0].props.value).toBe('essential')
  expect(blockTitles(root)).toEqual([])
  selectLevel(root, 'deep')
  expect(definitions(root)).toEqual([simple, detailed])
  expect(blockTitles(root)).toEqual(['strongDetail.definition.detailed'])
  selectLevel(root, 'essential')
  expect(definitions(root)).toEqual([simple])
})

it('remembers the chosen level for the next entry', () => {
  const entry = {
    ...props.entry,
    definitionHtml: '<p>Historical definition</p>',
    detailedDefinitionHtml: '<p>STEP definition</p>',
  }
  selectLevel(render({ entry }), 'deep')
  act(() => tree.unmount())
  const root = render({ entry: { ...entry, stepCode: 'G0267' } })
  expect(levelSwitch(root)[0].props.value).toBe('deep')
  expect(definitions(root)).toContain('<p>STEP definition</p>')
})

it('shows a detailed-only offline definition directly, without a level switch', () => {
  getDefaultStore().set(strongDefinitionLevelAtom, 'deep')
  const root = render({
    entry: { ...props.entry, detailedDefinitionHtml: '<p>STEP definition</p>' },
  })
  expect(definitions(root)).toEqual(['<p>STEP definition</p>'])
  expect(levelSwitch(root)).toHaveLength(0)
  expect(
    root.findAll(
      node =>
        String(node.type) === 'Text' &&
        node.props.children === 'strongLexicon.definitionUnavailable'
    )
  ).toHaveLength(0)
})

it('does not offer a deep level for an identical STEP definition without other enrichment', () => {
  const root = render({
    entry: { ...props.entry, definitionHtml: '<p>sin</p>', detailedDefinitionHtml: '<b>sin</b>' },
  })
  expect(levelSwitch(root)).toHaveLength(0)
  expect(definitions(root)).toEqual(['<p>sin</p>'])
})

it('does not offer a deep level with a simple-only copy and no enrichment', () => {
  const root = render({ entry: { ...props.entry, definitionHtml: '<p>sin</p>' } })
  expect(levelSwitch(root)).toHaveLength(0)
})

it('puts classical Greek in the deep level without repeating the identical STEP definition', () => {
  const root = render({
    entry: {
      ...props.entry,
      definitionHtml: '<p>sin</p>',
      detailedDefinitionHtml: '<b>sin</b>',
      resources: [
        {
          id: 1,
          source: 'LSJ',
          kind: 'dictionary',
          title: 'hamartia',
          contentHtml: '<p>Distinct dictionary content</p>',
        },
      ],
    },
  })
  expect(root.findAll(node => String(node.type) === 'StrongEditorialPreview')).toHaveLength(0)
  expect(levelSwitch(root)).toHaveLength(1)
  selectLevel(root, 'deep')
  expect(definitions(root)).toEqual(['<p>sin</p>'])
  expect(blockTitles(root)).toEqual(['strongDetail.definition.classicalGreek'])
  expect(root.find(node => String(node.type) === 'StrongEditorialPreview').props.value).toBe(
    '<p>Distinct dictionary content</p>'
  )
})

it('reads a similar formulation once and offers the deep level again for an enriched revision', () => {
  const pair = equivalences.find(pair => pair.stepCode === 'H0802G')!
  const entry = {
    ...props.entry,
    stepCode: pair.stepCode,
    gloss: 'femme',
    definitionHtml: pair.simple,
    detailedDefinitionHtml: pair.detailed,
  }
  const root = render({ entry })
  expect(definitions(root)).toEqual([pair.detailed])
  expect(levelSwitch(root)).toHaveLength(0)
  act(() =>
    tree.update(
      <StrongDetailMainPage
        {...props}
        entry={{
          ...entry,
          detailedDefinitionHtml:
            pair.detailed +
            ' Un nouveau sens avec une explication supplémentaire et plusieurs exemples qui ajoutent beaucoup de contenu.',
        }}
      />
    )
  )
  expect(levelSwitch(root)).toHaveLength(1)
  expect(definitions(root)).toEqual([pair.simple])
})

it('shows alternate senses at the deep level without claiming the definition is unavailable', () => {
  const pair = equivalences.find(pair => pair.stepCode === 'H0802G')!
  const root = render({
    entry: {
      ...props.entry,
      stepCode: pair.stepCode,
      gloss: 'femme',
      definitionHtml: pair.simple,
      detailedDefinitionHtml: pair.detailed,
      relations: [
        {
          stepCode: 'H0802H',
          group: 'subentry',
          relationKind: 'same_estrong',
          label: 'autre sens',
          gloss: 'femme : épouse',
          original: '',
          transliteration: '',
        },
      ],
    },
  })
  expect(root.findAll(node => String(node.type) === 'StrongLexicalRelationCard')).toHaveLength(0)
  selectLevel(root, 'deep')
  expect(blockTitles(root)).toEqual(['strongLexicon.otherMeanings'])
  expect(
    root.find(node => String(node.type) === 'StrongLexicalRelationCard').props.relation.stepCode
  ).toBe('H0802H')
  expect(
    root.findAll(
      node =>
        String(node.type) === 'Text' &&
        node.props.children === 'strongLexicon.definitionUnavailable'
    )
  ).toHaveLength(0)
})

it('retains a distinct name meaning while hiding a duplicate definition', () => {
  const root = render({
    entry: {
      ...props.entry,
      definitionHtml: 'sin',
      detailedDefinitionHtml: 'sin',
      nameMeaningHtml: 'A distinct etymology',
    },
  })
  selectLevel(root, 'deep')
  expect(definitions(root)).toEqual(['sin', 'A distinct etymology'])
  expect(blockTitles(root)).toEqual(['strongDetail.definition.nameMeaning'])
})

it('does not offer a deep level for a name meaning already in the definition', () => {
  const root = render({
    entry: {
      ...props.entry,
      definitionHtml: 'A name meaning',
      detailedDefinitionHtml: 'A name meaning',
      nameMeaningHtml: 'A name meaning',
    },
  })
  expect(levelSwitch(root)).toHaveLength(0)
})

it('shows the verse context immediately, without a disclosure control', () => {
  const root = render({
    contextVerse: { Livre: 1, Chapitre: 3, Verset: 2, Texte: 'Context passage' },
    contextReference: 'Genèse 3:2',
  })
  expect(
    root.findAll(node => String(node.type) === 'Text' && node.props.children === 'Genèse 3:2')
  ).toHaveLength(1)
  expect(
    root.findAll(
      node =>
        String(node.type) === 'TouchableBox' &&
        node.props.accessibilityLabel === 'strongDetail.context.title'
    )
  ).toHaveLength(0)
})

it('shows a specific sense first and keeps the general definition at the deep level', () => {
  const specificSense = 'un homme de la tribu de Benjamin, fils de Saül et ami de David'
  const general = 'tuer abattre battre nourriture sacrifice abattage mot douteux'
  const root = render({
    entry: {
      ...props.entry,
      language: 'hebrew',
      stepCode: 'H7819B',
      definitionHtml: general,
      detailedDefinitionHtml: specificSense,
      relations: [
        {
          stepCode: 'H7819A',
          group: 'subentry' as const,
          relationKind: 'same_estrong',
          label: '',
          gloss: '',
          original: '',
          transliteration: '',
        },
      ],
    },
  })
  expect(definitions(root)).toEqual([specificSense])
  selectLevel(root, 'deep')
  expect(definitions(root)).toEqual([specificSense, general])
  expect(blockTitles(root)).toEqual([
    'strongDetail.definition.generalEntry',
    'strongLexicon.otherMeanings',
  ])
})

it('shows the concordance section and jump link while loading, without a false zero', () => {
  const root = render()
  expect(
    root.findAll(
      node => String(node.type) === 'StrongEditorialSection' && node.props.title === 'Concordance'
    )
  ).toHaveLength(1)
  expect(
    root.findAll(node => String(node.type) === 'Text' && node.props.children === 'Concordance')
  ).toHaveLength(1)
  expect(root.findAll(node => String(node.type) === 'Loading')).toHaveLength(1)
  expect(
    root.findAll(node => String(node.type) === 'Text' && node.props.children === '—')
  ).toHaveLength(1)
})
it('shows an error and retries without hiding the already loaded total', () => {
  const retry = jest.fn()
  const root = render({
    concordanceCount: 12,
    concordanceTotalCount: 12,
    concordanceLoading: false,
    concordanceError: true,
    onRetryConcordance: retry,
  })
  expect(
    root.findAll(node => String(node.type) === 'Text' && node.props.children === 12)
  ).toHaveLength(1)
  expect(
    root.findAll(node => String(node.type) === 'Text' && node.props.accessibilityRole === 'alert')
  ).toHaveLength(1)
  const button = root.find(
    node => String(node.type) === 'TouchableBox' && node.props.accessibilityRole === 'button'
  )
  act(() => button.props.onPress())
  expect(retry).toHaveBeenCalledTimes(1)
})
it('explains a confirmed empty concordance', () => {
  const root = render({ concordanceCount: 0, concordanceTotalCount: 0, concordanceLoading: false })
  expect(
    root.findAll(
      node =>
        String(node.type) === 'Text' && node.props.children === 'strongDetail.concordance.empty'
    )
  ).toHaveLength(1)
})

it('disables retry while requests are in flight', () => {
  const root = render({
    concordanceLoading: false,
    concordanceError: true,
    concordanceRetrying: true,
  })
  const button = root.find(
    node => String(node.type) === 'TouchableBox' && node.props.accessibilityRole === 'button'
  )
  expect(button.props.disabled).toBe(true)
  expect(
    root.findAll(node => String(node.type) === 'Text' && node.props.children === 'Chargement...')
  ).toHaveLength(1)
})

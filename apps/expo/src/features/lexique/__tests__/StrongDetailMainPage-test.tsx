import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import StrongDetailMainPage from '../StrongDetailMainPage'

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
jest.mock('~common/Loading', () => 'Loading')
jest.mock('~features/bible/ConcordanceVerse', () => 'ConcordanceVerse')
jest.mock('~features/bible/ListenStrong', () => ({
  __esModule: true,
  default: 'ListenStrong',
  hasStrongAudio: () => false,
}))
jest.mock('../StrongEntryMetadata', () => 'StrongEntryMetadata')
jest.mock('../StrongEntityRelationGraph', () => ({
  StrongEntityRelationGraph: 'StrongEntityRelationGraph',
}))
jest.mock('../StrongPassageMediaSection', () => 'StrongPassageMediaSection')
jest.mock('../StrongDetailUI', () => ({
  StrongEditorialHtml: 'StrongEditorialHtml',
  StrongEditorialPreview: 'StrongEditorialPreview',
  StrongEditorialSection: 'StrongEditorialSection',
  StrongEyebrow: 'StrongEyebrow',
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
afterEach(() => {
  act(() => tree?.unmount())
})
const render = (overrides: Partial<Props> = {}) => {
  act(() => {
    tree = create(<StrongDetailMainPage {...props} {...overrides} />)
  })
  return tree.root
}
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

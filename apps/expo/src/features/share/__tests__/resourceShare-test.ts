import Clipboard from '@react-native-clipboard/clipboard'
import { Platform, Share } from 'react-native'
import { toast } from '~helpers/toast'
import {
  COPY_TEXT_ACTION,
  SHARE_LINK_ACTION,
  copyResourceText,
  resourceShareMenuActions,
  runResourceShareAction,
  shareResourceLink,
} from '../resourceShare'

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }))
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn() },
}))
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Share: { share: jest.fn(() => Promise.resolve()) },
}))
jest.mock('~helpers/toast', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }))
jest.mock('~i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }))

const t = ((key: string) => key) as unknown as Parameters<typeof resourceShareMenuActions>[0]
const setPlatform = (os: typeof Platform.OS) => Object.assign(Platform, { OS: os })
const flush = () => new Promise(resolve => setImmediate(resolve))

beforeEach(() => {
  jest.clearAllMocks()
  setPlatform('ios')
})

it('offers the link and the text of a resource that has a page', () => {
  expect(
    resourceShareMenuActions(t, { url: 'https://bible-strong.app/x', text: () => 'x' }).map(
      action => action.id
    )
  ).toEqual([SHARE_LINK_ACTION, COPY_TEXT_ACTION])
})

it('offers the text alone when there is no page to link, and nothing without a resource', () => {
  expect(resourceShareMenuActions(t, { text: () => 'x' }).map(action => action.id)).toEqual([
    COPY_TEXT_ACTION,
  ])
  expect(resourceShareMenuActions(t, undefined)).toEqual([])
})

it('shares the link alone, so that the receiving app draws the card of the page', async () => {
  await shareResourceLink({ url: 'https://bible-strong.app/strong/fr/g26' })
  expect(Share.share).toHaveBeenCalledWith({ url: 'https://bible-strong.app/strong/fr/g26' })
  expect(Clipboard.setString).not.toHaveBeenCalled()
})

it('shares the link alone on Android, with no subject beside it', async () => {
  setPlatform('android')
  await shareResourceLink({ url: 'https://bible-strong.app/strong/fr/g26' })
  expect(Share.share).toHaveBeenCalledWith({ message: 'https://bible-strong.app/strong/fr/g26' })
})

it('shares the link alone in a browser with a share sheet, with no title beside it', async () => {
  setPlatform('web')
  Object.assign(globalThis, { navigator: { share: jest.fn() } })
  await shareResourceLink({ url: 'https://bible-strong.app/strong/fr/g26' })
  expect(Share.share).toHaveBeenCalledWith({ url: 'https://bible-strong.app/strong/fr/g26' })
})

it('shares nothing when there is no link', async () => {
  await shareResourceLink({})
  expect(Share.share).not.toHaveBeenCalled()
})

it('copies the text alone, even when it comes later', async () => {
  await copyResourceText({ text: async () => 'Jean 3:16' })
  expect(Clipboard.setString).toHaveBeenCalledWith('Jean 3:16')
  expect(toast).toHaveBeenCalledWith('Copié dans le presse-papiers.')
  expect(Share.share).not.toHaveBeenCalled()
})

it('tells the reader when the text cannot be read', async () => {
  await copyResourceText({
    text: async () => {
      throw new Error('offline')
    },
  })
  expect(Clipboard.setString).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith('Erreur lors du partage.')
})

it('runs its own menu entries and leaves the others to the menu', async () => {
  const share = { url: 'https://bible-strong.app/x', text: () => 'x' }
  expect(runResourceShareAction(SHARE_LINK_ACTION, share)).toBe(true)
  expect(runResourceShareAction(COPY_TEXT_ACTION, share)).toBe(true)
  expect(runResourceShareAction('open-tab', share)).toBe(false)
  expect(runResourceShareAction(SHARE_LINK_ACTION, undefined)).toBe(false)
  await flush()
  expect(Share.share).toHaveBeenCalledTimes(1)
  expect(Clipboard.setString).toHaveBeenCalledWith('x')
})

import Clipboard from '@react-native-clipboard/clipboard'
import * as Sentry from '@sentry/react-native'
import type { TFunction } from 'i18next'
import { Platform, Share } from 'react-native'
import type { MenuAction } from '~common/ui/MenuView'
import { toast } from '~helpers/toast'
import i18n from '~i18n'

/**
 * What a tab hands over so that it can be shared: the address of its page on the public
 * site, when it has one, and its text. The two are never mixed. The link is sent alone, so
 * that the receiving app draws the card of the page; the text is copied alone, for whoever
 * wants to paste it.
 */
export type ResourceShare = {
  /** The page of the public site; absent when the site has no page for what is read. */
  url?: string
  title?: string
  text: () => string | Promise<string>
}

export const SHARE_LINK_ACTION = 'share-link'
export const COPY_TEXT_ACTION = 'copy-text'

/** Their icons where a menu is drawn as a panel, which names its icons apart. */
export const RESOURCE_SHARE_ICONS = {
  [SHARE_LINK_ACTION]: 'share-2',
  [COPY_TEXT_ACTION]: 'copy',
} as const

/** The two share entries of a tab menu; the link is left out when there is no page to link. */
export const resourceShareMenuActions = (
  t: TFunction,
  share: ResourceShare | undefined
): MenuAction[] =>
  share
    ? [
        ...(share.url
          ? [
              {
                id: SHARE_LINK_ACTION,
                title: t('Partager le lien'),
                image: 'square.and.arrow.up' as const,
              },
            ]
          : []),
        { id: COPY_TEXT_ACTION, title: t('Copier le texte'), image: 'doc.on.doc' as const },
      ]
    : []

export const shareResourceLink = async ({ url, title }: Pick<ResourceShare, 'url' | 'title'>) => {
  if (!url) return
  try {
    // A browser without a share sheet: the link is copied instead.
    if (Platform.OS === 'web' && typeof navigator.share !== 'function') {
      Clipboard.setString(url)
      toast(i18n.t('Copié dans le presse-papiers.'))
      return
    }
    // iOS hands a link over as a link; elsewhere the message is the link itself.
    await Share.share(Platform.OS === 'ios' ? { url } : { message: url, title })
  } catch (error) {
    toast.error(i18n.t('Erreur lors du partage.'))
    Sentry.captureException(error)
  }
}

export const copyResourceText = async ({ text }: Pick<ResourceShare, 'text'>) => {
  try {
    Clipboard.setString(await text())
    toast(i18n.t('Copié dans le presse-papiers.'))
  } catch (error) {
    toast.error(i18n.t('Erreur lors du partage.'))
    Sentry.captureException(error)
  }
}

/** Runs a share entry of a menu; says whether the event was one of them. */
export const runResourceShareAction = (
  event: string,
  share: ResourceShare | undefined
): boolean => {
  if (!share) return false
  if (event === SHARE_LINK_ACTION) {
    void shareResourceLink(share)
    return true
  }
  if (event === COPY_TEXT_ACTION) {
    void copyResourceText(share)
    return true
  }
  return false
}

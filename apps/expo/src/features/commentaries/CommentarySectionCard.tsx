import { Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { CommentaryCatalogEntry } from '@bible-strong/resource-catalog/commentaries'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import SwitchableHTMLView from '~common/SwitchableHTMLView'
import { getCommentaryBookLabel } from './commentaryBookLabel'
import CommentaryRoomIntro from './CommentaryRoomIntro'
import CommentaryEntryNavigation from './CommentaryEntryNavigation'
import { commentaryHrefToOsis } from './commentaryResourceParams'
import {
  getCommentaryBibleViewRoute,
  getCommentaryPassageBibleViewRoute,
} from './commentaryReferenceNavigation'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

/** Shared article presentation for the full page and its inline preview. */
export default function CommentarySectionCard({
  entry,
  language,
  book,
  chapter,
  section,
  onPrevious,
  onNext,
  onResourcePress,
  preview = false,
}: {
  entry: CommentaryCatalogEntry
  language: 'fr' | 'en'
  book: number
  chapter: number
  section: { rangeStartVerse: number; rangeEndVerse: number; content: string }
  onPrevious?: () => void
  onNext?: () => void
  onResourcePress?: () => void
  preview?: boolean
}) {
  const pushRouteOnce = usePushRouteOnce()
  const { t } = useTranslation()
  const start = section.rangeStartVerse
  const end = section.rangeEndVerse
  const article = (
    <>
      {!preview && (
        <CommentaryEntryNavigation
          hasPrevious={!!onPrevious}
          hasNext={!!onNext}
          onPrevious={() => onPrevious?.()}
          onNext={() => onNext?.()}
          reference={
            start === 0
              ? t('commentaries.resource.introduction')
              : `${getCommentaryBookLabel(book)} ${chapter}:${start}${end !== start ? `–${end}` : ''}`
          }
          referenceDisabled={start === 0}
          onReferencePress={() => {
            const route = getCommentaryPassageBibleViewRoute({
              book,
              chapter,
              startVerse: start,
              endVerse: end,
            })
            if (route) pushRouteOnce(route)
          }}
        />
      )}
      <Box className={preview ? undefined : 'mt-[14px]'}>
        <SwitchableHTMLView
          value={section.content}
          onLinkPress={href => {
            const osis = commentaryHrefToOsis(href)
            const route = osis ? getCommentaryBibleViewRoute(osis) : undefined
            if (route) pushRouteOnce(route)
            else if (/^https?:\/\//iu.test(href)) void Linking.openURL(href)
          }}
        />
      </Box>
    </>
  )
  // The preview sits on its sheet, which is already the raised surface: it takes no card.
  if (preview) return <Box>{article}</Box>
  return (
    <>
      <CommentaryRoomIntro compact entry={entry} language={language} onPress={onResourcePress} />
      <Card className="px-[18px] py-[18px]">{article}</Card>
    </>
  )
}

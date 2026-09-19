import { Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { CommentaryCatalogEntry } from '@bible-strong/resource-catalog/commentaries'
import Box from '~common/ui/Box'
import SwitchableHTMLView from '~common/SwitchableHTMLView'
import { getBook } from '~helpers/bibleBookCatalog'
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
  return (
    <>
      {!preview && (
        <CommentaryRoomIntro compact entry={entry} language={language} onPress={onResourcePress} />
      )}
      <Box
        className="bg-reverse rounded-[20px] px-[18px] py-[18px]"
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
        }}
      >
        {!preview && (
          <CommentaryEntryNavigation
            hasPrevious={!!onPrevious}
            hasNext={!!onNext}
            onPrevious={() => onPrevious?.()}
            onNext={() => onNext?.()}
            reference={
              start === 0
                ? t('commentaries.resource.introduction')
                : `${getBook(book)?.Nom ?? book} ${chapter}:${start}${end !== start ? `–${end}` : ''}`
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
      </Box>
    </>
  )
}

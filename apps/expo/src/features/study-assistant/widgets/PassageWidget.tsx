import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { PassageTarget, PassageWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { getBibleVersionVersificationId, getVersions } from '~helpers/bibleVersions'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import AssistantMessageMarkdown from '../AssistantMessageMarkdown'
import { loadWidgetPassage } from './passageData'
import { textDifferences } from './textDifferences'
import WidgetFrame, {
  WidgetDisclosure,
  WidgetIconButton,
  WidgetLoading,
  WidgetNotice,
  WidgetUnavailable,
} from './WidgetFrame'
import WidgetSelect from './WidgetSelect'

const identity = (p: PassageTarget) => `${p.version}:${p.book}:${p.chapter}:${p.start}:${p.end}`
const verseNumbers = (p: PassageTarget) =>
  Array.from({ length: p.end - p.start + 1 }, (_, i) => p.start + i)

function PassageCard({
  passage,
  versions,
  onVersion,
  reference,
}: {
  passage: PassageTarget
  versions?: string[]
  onVersion?: (version: string) => void
  reference?: PassageTarget
}) {
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    navigate = usePushRouteOnce()
  const label = verseToReference({
    bookNum: passage.book,
    chapterNum: passage.chapter,
    verses: verseNumbers(passage),
  })
  const query = useQuery({
    queryKey: ['assistant-widget-passage', identity(passage)],
    queryFn: ({ signal }) => loadWidgetPassage(passage, resources.bibleContent, signal),
    staleTime: 300000,
  })
  const baseline = useQuery({
    queryKey: ['assistant-widget-passage', identity(reference || passage)],
    queryFn: ({ signal }) =>
      loadWidgetPassage(reference || passage, resources.bibleContent, signal),
    enabled: !!reference,
    staleTime: 300000,
  })
  const open = () =>
    navigate({
      pathname: '/bible-view',
      params: {
        book: String(passage.book),
        chapter: String(passage.chapter),
        verse: String(passage.start),
        focusVerses: JSON.stringify(verseNumbers(passage)),
        version: passage.version,
        contextDisplayMode: 'focused',
      },
    })
  return (
    <Box className="border-border border-b px-3 py-[10px]">
      <HStack className="items-center gap-2">
        <TouchableBox accessibilityRole="button" onPress={open} className="shrink">
          <Text className="text-primary text-[14px] font-semibold" numberOfLines={1}>
            {label}
          </Text>
        </TouchableBox>
        {onVersion ? (
          <WidgetSelect
            label={t('assistant.widgets.translationFor', {
              reference: label,
              version: passage.version,
            })}
            value={passage.version}
            items={(versions || [passage.version]).map(id => ({ id, label: id }))}
            onChange={onVersion}
          />
        ) : (
          <Text className="text-grey text-[12px]">{passage.version}</Text>
        )}
        <Box className="flex-1" />
        <WidgetIconButton
          icon="arrow-up-right"
          label={t('assistant.widgets.open', { reference: label })}
          onPress={open}
        />
      </HStack>
      {query.isPending ? (
        <WidgetLoading />
      ) : query.isError ? (
        <WidgetUnavailable
          message={t('assistant.widgets.unavailable')}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <Box className="gap-1 pt-1">
          {query.data.map(verse => (
            <Text key={verse.number} selectable className="text-[15px] leading-[24px]">
              <Text className="text-grey text-[11px]">{verse.number} </Text>
              {reference && baseline.data
                ? textDifferences(
                    verse.text,
                    baseline.data.find(item => item.number === verse.number)?.text || ''
                  ).map((part, i) =>
                    part.different ? (
                      <Text key={i} className="bg-light-secondary text-[15px] leading-[24px]">
                        {part.text}
                      </Text>
                    ) : (
                      part.text
                    )
                  )
                : verse.text}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  )
}

export default function PassageWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  const [translationPassages, setTranslationPassages] = useState(widget.passages)
  const [differences, setDifferences] = useState(false)
  const translation = widget.kind === 'translation_comparison'
  const catalog = Object.values(getVersions()).filter(version => !version.hidden)
  const passages = translation ? translationPassages : widget.passages
  return (
    <WidgetFrame
      title={widget.title}
      eyebrow={t(`assistant.widgets.${translation ? widget.kind : 'passages'}`)}
    >
      {translation && (
        <Box className="border-border gap-1 border-b px-3 py-2">
          <TouchableBox
            accessibilityRole="checkbox"
            accessibilityState={{ checked: differences }}
            onPress={() => setDifferences(value => !value)}
            className="flex-row items-center gap-2 py-1"
          >
            <Checkbox checked={differences} size={17} />
            <Text className="text-[14px]">{t('assistant.widgets.highlightDifferences')}</Text>
          </TouchableBox>
          {passages.some((p, i) => p.version !== widget.passages[i]?.version) && (
            <WidgetNotice>{t('assistant.widgets.translationChanged')}</WidgetNotice>
          )}
          {new Set(passages.map(p => getBibleVersionVersificationId(p.version))).size > 1 && (
            <WidgetNotice>{t('assistant.widgets.versificationHint')}</WidgetNotice>
          )}
        </Box>
      )}
      {passages.map((passage, i) => (
        <PassageCard
          key={`${identity(passage)}:${i}`}
          passage={passage}
          versions={
            translation
              ? [
                  ...new Set([
                    passage.version,
                    ...catalog
                      .map(version => version.id)
                      .filter(
                        version =>
                          !passages.some((p, index) => index !== i && p.version === version)
                      ),
                  ]),
                ]
              : undefined
          }
          onVersion={
            translation
              ? version =>
                  setTranslationPassages(previous =>
                    previous.map((p, index) => (index === i ? { ...p, version } : p))
                  )
              : undefined
          }
          reference={translation && differences && i > 0 ? passages[0] : undefined}
        />
      ))}
      {!!widget.analysis && (
        <Box className="px-3 pb-2">
          <WidgetDisclosure title={t('assistant.widgets.analysis')}>
            <AssistantMessageMarkdown
              text={widget.analysis}
              streaming={false}
              sources={[]}
              widgets={[]}
            />
          </WidgetDisclosure>
        </Box>
      )}
    </WidgetFrame>
  )
}

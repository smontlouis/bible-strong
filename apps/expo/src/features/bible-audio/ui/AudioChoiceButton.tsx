import { useAtomValue } from 'jotai/react'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import ContextualPanel from '~common/ContextualPanel'
import Box, { TouchableBox } from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import SheetWell from '~common/ui/SheetWell'
import Text from '~common/ui/Text'
import { bibleAudioStateAtom } from '../atoms'
import {
  getRecordingAttribution,
  getRecordingName,
  recordingCoversBook,
  SPEECH_CHOICE,
  useVersionRecordings,
  type BibleAudioChoice,
  type BibleAudioRecording,
} from '../audioCatalog'
import books from '~assets/bible_versions/books-desc'
import { chooseBibleAudio } from '../bibleAudioPlayer'
import { getRecordingCoverage } from '../recordingCoverage'
import type { BibleAudioPassage } from '../types'
import PlayerPill from './PlayerPill'

type IconName = ComponentProps<typeof IonIcon>['name']

const getRecordingIcon = (recording: BibleAudioRecording): IconName =>
  recording.kind === 'drama' ? 'people-outline' : 'mic-outline'

type ChoiceRowProps = {
  icon: IconName
  label: string
  detail?: string
  isSelected: boolean
  /** Not for the book heard: choosing it opens the first chapter it covers. */
  opensElsewhere?: string
  onPress: () => void
}

const ChoiceRow = ({
  icon,
  label,
  detail,
  isSelected,
  opensElsewhere,
  onPress,
}: ChoiceRowProps) => (
  <TouchableBox
    className="flex-row items-center px-[14px] min-h-[56px] py-[10px]"
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityLabel={detail ? `${label}, ${detail}` : label}
    accessibilityHint={opensElsewhere}
    accessibilityState={{ checked: isSelected }}
  >
    <IonIcon name={icon} size={22} color={isSelected ? 'primary' : 'default'} />
    <Box className="flex-[1] min-w-0 ml-[12px]">
      <Text
        className={isSelected ? 'text-link text-[15px] font-semibold' : 'text-[15px]'}
        numberOfLines={1}
      >
        {label}
      </Text>
      {!!detail && (
        <Text className="text-[12px] text-grey mt-[1px]" numberOfLines={2}>
          {detail}
        </Text>
      )}
    </Box>
    {isSelected && <IonIcon name="checkmark" size={20} color="primary" />}
    {!isSelected && !!opensElsewhere && (
      <IonIcon name="arrow-forward-outline" size={18} color="grey" />
    )}
  </TouchableBox>
)

/**
 * What a partial recording covers, said in its row whether the book heard is among them or not:
 * « Proverbes et Jean », or « Seulement Proverbes et Jean » when it is not.
 */
const useCoverageText = () => {
  const { t } = useTranslation()
  return (recording: BibleAudioRecording, covers: boolean) => {
    const coverage = getRecordingCoverage(recording)
    switch (coverage.kind) {
      case 'all':
        return undefined
      case 'testament':
        return coverage.testament === 'old'
          ? t(covers ? 'bibleAudio.coverage.old' : 'bibleAudio.coverage.onlyOld')
          : t(covers ? 'bibleAudio.coverage.new' : 'bibleAudio.coverage.onlyNew')
      default: {
        const names =
          coverage.kind === 'books'
            ? coverage.books.map(number => {
                const book = books.find(candidate => candidate.Numero === number)
                return book ? t(book.Nom) : String(number)
              })
            : []
        const text =
          coverage.kind === 'count'
            ? t('bibleAudio.coverage.bookCount', { count: coverage.count })
            : names.length > 1
              ? t('bibleAudio.coverage.and', {
                  list: names.slice(0, -1).join(', '),
                  last: names.at(-1),
                })
              : (names[0] ?? '')
        return covers ? text : t('bibleAudio.coverage.only', { coverage: text })
      }
    }
  }
}

/** « Opens Proverbs »: where a recording that skips the book heard takes the reader. */
const useOpensFirstBook = () => {
  const { t } = useTranslation()
  return (recording: BibleAudioRecording) => {
    const first = [...(recording.books ?? [])].sort((a, b) => a - b)[0]
    const book = books.find(candidate => candidate.Numero === first)
    return book ? t('bibleAudio.coverage.opens', { book: t(book.Nom) }) : undefined
  }
}

const Hairline = () => (
  <Box
    className="ml-[48px] border-separator"
    style={{ borderBottomWidth: StyleSheet.hairlineWidth }}
  />
)

type AudioChoiceButtonProps = { passage: BibleAudioPassage }

/**
 * The first option of the player: what the version is heard with. It opens « Listen with », the
 * version's recordings and the device's voice (ADR-0117): a sheet on a phone, a popover on the web.
 */
const AudioChoiceButton = ({ passage }: AudioChoiceButtonProps) => {
  const { t } = useTranslation()
  const coverageText = useCoverageText()
  const opensFirstBook = useOpensFirstBook()
  const { source, recordingId } = useAtomValue(bibleAudioStateAtom)
  const recordings = useVersionRecordings(passage.version)
  const isSpeech = source === 'speech'
  const current = recordings.find(recording => recording.id === recordingId)

  const choose = (choice: BibleAudioChoice, close: () => void) => {
    void chooseBibleAudio(choice)
    close()
  }

  const currentLabel = isSpeech
    ? t('bibleAudio.speech')
    : current
      ? getRecordingName(current)
      : t('bibleAudio.recorded')

  return (
    <ContextualPanel
      accessibilityLabel={`${t('bibleAudio.listenWith')}: ${currentLabel}`}
      initialScreen="choice"
      width={340}
      // The pill sits low in the player: the web popover opens above it.
      placement="top start"
      // The same pill whatever is heard: it names it, and opens the choice.
      trigger={<PlayerPill icon="mic-outline" label={currentLabel} />}
      screens={{
        choice: {
          title: t('bibleAudio.listenWith'),
          content: navigation => (
            <Box className="px-[16px] pb-[16px] gap-[8px]">
              {recordings.length > 0 && (
                <>
                  <Text className="text-[13px] text-grey mt-[8px] ml-[4px]">
                    {t('bibleAudio.recordings')}
                  </Text>
                  <SheetWell>
                    {recordings.map((recording, index) => {
                      const covers = recordingCoversBook(recording, passage.book.Numero)
                      const kind =
                        recording.kind === 'drama' ? t('bibleAudio.kind.drama') : undefined
                      const coverage = coverageText(recording, covers)
                      // The publisher's mention, when it asks for one, says who it is.
                      const detail = covers
                        ? [
                            kind,
                            coverage,
                            getRecordingAttribution(recording)?.label ?? recording.credit,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : coverage
                      return (
                        <Box key={recording.id}>
                          {index > 0 && <Hairline />}
                          <ChoiceRow
                            icon={getRecordingIcon(recording)}
                            label={getRecordingName(recording)}
                            detail={detail || undefined}
                            isSelected={!isSpeech && recording.id === recordingId}
                            opensElsewhere={covers ? undefined : opensFirstBook(recording)}
                            onPress={() => choose(recording.id, navigation.close)}
                          />
                        </Box>
                      )
                    })}
                  </SheetWell>
                </>
              )}
              <Text className="text-[13px] text-grey mt-[8px] ml-[4px]">
                {t('bibleAudio.deviceVoice')}
              </Text>
              <SheetWell>
                <ChoiceRow
                  icon="chatbubble-ellipses-outline"
                  label={t('bibleAudio.speech')}
                  detail={t('bibleAudio.speechDetail')}
                  isSelected={isSpeech}
                  onPress={() => choose(SPEECH_CHOICE, navigation.close)}
                />
              </SheetWell>
            </Box>
          ),
        },
      }}
    />
  )
}

export default AudioChoiceButton

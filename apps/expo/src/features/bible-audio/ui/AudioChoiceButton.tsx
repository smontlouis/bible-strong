import { useAtomValue } from 'jotai/react'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { Sheet, SheetHeader, SheetScrollView } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import SheetWell from '~common/ui/SheetWell'
import Text from '~common/ui/Text'
import { useSheet } from '~helpers/useSheet'
import { bibleAudioStateAtom } from '../atoms'
import {
  getRecordingName,
  recordingCoversBook,
  SPEECH_CHOICE,
  useVersionRecordings,
  type BibleAudioChoice,
  type BibleAudioRecording,
} from '../audioCatalog'
import { chooseBibleAudio } from '../bibleAudioPlayer'
import type { BibleAudioPassage } from '../types'
import PlayerOption from './PlayerOption'

type IconName = ComponentProps<typeof IonIcon>['name']

const getRecordingIcon = (recording: BibleAudioRecording): IconName =>
  recording.kind === 'drama' ? 'people-outline' : 'mic-outline'

type ChoiceRowProps = {
  icon: IconName
  label: string
  detail?: string
  isSelected: boolean
  isDisabled?: boolean
  onPress: () => void
}

const ChoiceRow = ({ icon, label, detail, isSelected, isDisabled, onPress }: ChoiceRowProps) => (
  <TouchableBox
    className="flex-row items-center px-[14px] min-h-[56px] py-[10px]"
    style={{ opacity: isDisabled ? 0.45 : 1 }}
    disabled={isDisabled}
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityLabel={detail ? `${label}, ${detail}` : label}
    accessibilityState={{ checked: isSelected, disabled: isDisabled }}
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
        <Text className="text-[12px] text-grey mt-[1px]" numberOfLines={1}>
          {detail}
        </Text>
      )}
    </Box>
    {isSelected && <IonIcon name="checkmark" size={20} color="primary" />}
  </TouchableBox>
)

const Hairline = () => (
  <Box
    className="ml-[48px] border-separator"
    style={{ borderBottomWidth: StyleSheet.hairlineWidth }}
  />
)

type AudioChoiceButtonProps = { passage: BibleAudioPassage }

/**
 * The first option of the player: what the version is heard with. It opens « Listen with », the
 * version's recordings and the device's voice (ADR-0117).
 */
const AudioChoiceButton = ({ passage }: AudioChoiceButtonProps) => {
  const { t } = useTranslation()
  const { ref, open, close } = useSheet()
  const { source, recordingId } = useAtomValue(bibleAudioStateAtom)
  const recordings = useVersionRecordings(passage.version)
  const isSpeech = source === 'speech'
  const current = recordings.find(recording => recording.id === recordingId)

  const choose = (choice: BibleAudioChoice) => {
    chooseBibleAudio(choice)
    close()
  }

  const currentLabel = isSpeech
    ? t('bibleAudio.speech')
    : current
      ? getRecordingName(current)
      : t('bibleAudio.recorded')

  return (
    <>
      <TouchableBox
        onPress={() => open()}
        accessibilityRole="button"
        accessibilityLabel={t('bibleAudio.listenWith')}
        accessibilityHint={currentLabel}
      >
        <PlayerOption
          isActive={recordings.length > 1 || isSpeech}
          icon={
            isSpeech
              ? 'chatbubble-ellipses-outline'
              : current
                ? getRecordingIcon(current)
                : 'mic-outline'
          }
        />
      </TouchableBox>
      <Sheet
        ref={ref}
        snapPoints={['auto']}
        header={<SheetHeader title={t('bibleAudio.listenWith')} centerTitle />}
      >
        <SheetScrollView>
          <Box className="px-[16px] pb-[24px] gap-[8px]">
            {recordings.length > 0 && (
              <>
                <Text className="text-[13px] text-grey mt-[8px] ml-[4px]">
                  {t('bibleAudio.recordings')}
                </Text>
                <SheetWell>
                  {recordings.map((recording, index) => {
                    const covers = recordingCoversBook(recording, passage.book.Numero)
                    const kind = recording.kind === 'drama' ? t('bibleAudio.kind.drama') : undefined
                    const detail = covers
                      ? [kind, recording.credit].filter(Boolean).join(' · ')
                      : t('bibleAudio.notThisBook', { book: t(passage.book.Nom) })
                    return (
                      <Box key={recording.id}>
                        {index > 0 && <Hairline />}
                        <ChoiceRow
                          icon={getRecordingIcon(recording)}
                          label={getRecordingName(recording)}
                          detail={detail || undefined}
                          isSelected={!isSpeech && recording.id === recordingId}
                          isDisabled={!covers}
                          onPress={() => choose(recording.id)}
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
                onPress={() => choose(SPEECH_CHOICE)}
              />
            </SheetWell>
          </Box>
        </SheetScrollView>
      </Sheet>
    </>
  )
}

export default AudioChoiceButton

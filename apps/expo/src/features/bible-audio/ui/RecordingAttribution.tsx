import { Image } from 'expo-image'
import { useAtomValue } from 'jotai/react'
import { Linking } from 'react-native'
import { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { radii } from '~common/ui/surfaces'
import { bibleAudioStateAtom } from '../atoms'
import { getRecording, getRecordingAttribution } from '../audioCatalog'

const LOGO_SIZE = 20

/**
 * The mention a publisher sets as a condition of its recording (ADR-0117): its logo and label,
 * opening its site, under the controls for as long as one of its chapters is heard.
 */
const RecordingAttribution = () => {
  const { source, recordingId } = useAtomValue(bibleAudioStateAtom)
  const attribution =
    source === 'recorded' ? getRecordingAttribution(getRecording(recordingId)) : undefined
  if (!attribution) return null

  return (
    <TouchableBox
      className="flex-row items-center self-center px-[10px] py-[6px]"
      onPress={() => void Linking.openURL(attribution.url)}
      accessibilityRole="link"
      accessibilityLabel={attribution.label}
    >
      {!!attribution.logo && (
        <Image
          source={{ uri: attribution.logo }}
          style={{
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            borderRadius: radii.tile,
            marginRight: 6,
          }}
          contentFit="contain"
          accessible={false}
        />
      )}
      <Text className="text-[12px] text-grey font-medium underline">{attribution.label}</Text>
    </TouchableBox>
  )
}

export default RecordingAttribution

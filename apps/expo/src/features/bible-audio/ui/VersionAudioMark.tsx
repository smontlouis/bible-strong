import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useVersionRecordings } from '../audioCatalog'

/** The speaker beside a version that has recordings, with their number when there are several. */
const VersionAudioMark = ({ version }: { version: string }) => {
  const { t } = useTranslation()
  const count = useVersionRecordings(version).length
  if (!count) return null
  return (
    <Box
      className="flex-row items-center"
      accessible
      accessibilityLabel={
        count > 1 ? t('bibleAudio.recordingCount', { count }) : t('bibleAudio.recorded')
      }
    >
      <FeatherIcon name="volume-2" size={16} color="primary" />
      {count > 1 && <Text className="text-[11px] font-bold text-link ml-[2px]">{count}</Text>}
    </Box>
  )
}

export default VersionAudioMark

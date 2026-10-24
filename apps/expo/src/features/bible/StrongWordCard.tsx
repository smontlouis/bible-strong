import { Platform } from 'react-native'
import { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { SelectionStrongWordPreview } from './useSelectionStrongWords'

export type StrongWordItemProps = {
  word: SelectionStrongWordPreview
  onPress: () => void
}

const originalFontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif'

export const getStrongWordCaption = (word: SelectionStrongWordPreview) =>
  [word.identity.code, word.transliteration].filter(Boolean).join(' · ')

/**
 * A Hebrew or Greek word under the selected words, among the actions of the selection sheet: the
 * words of the text, the original word, its number. It opens the word's entry.
 */
export default function StrongWordCard({ word, onPress }: StrongWordItemProps) {
  const caption = getStrongWordCaption(word)
  return (
    <TouchableBox
      accessibilityRole="button"
      accessibilityLabel={[word.word, word.original, caption].filter(Boolean).join(', ')}
      onPress={onPress}
      className="mt-[8px] mr-[8px] h-[64px] min-w-[84px] max-w-[160px] px-[12px] justify-center rounded-[12px] bg-light-grey"
    >
      <Text className="text-[14px] leading-[18px] font-semibold" numberOfLines={1}>
        {word.word}
      </Text>
      {!!word.original && (
        <Text
          className="text-[16px] leading-[21px]"
          style={{ fontFamily: originalFontFamily }}
          numberOfLines={1}
        >
          {word.original}
        </Text>
      )}
      <Text className="text-[11px] leading-[14px] font-semibold text-link" numberOfLines={1}>
        {caption}
      </Text>
    </TouchableBox>
  )
}

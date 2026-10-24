import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useSelectionMenu } from './SelectedVersesModal/selectionMenuContext'
import StrongWordCard, { getStrongWordCaption, type StrongWordItemProps } from './StrongWordCard'

/** A card in the selection sheet, a row in the desktop selection menu. */
export default function StrongWordItem(props: StrongWordItemProps) {
  const menu = useSelectionMenu()
  if (!menu) return <StrongWordCard {...props} />
  const { word, onPress } = props
  return (
    <TouchableBox
      accessibilityRole="button"
      onPress={onPress}
      className="w-full flex-row items-center gap-[8px] px-[10px] h-[34px] rounded-lg"
    >
      <Text className="text-[14px] flex-shrink" numberOfLines={1}>
        {word.word}
      </Text>
      {!!word.original && (
        <Text
          className="text-[14px] flex-shrink"
          style={{ fontFamily: 'Georgia, serif' }}
          numberOfLines={1}
        >
          {word.original}
        </Text>
      )}
      <Box className="flex-1" />
      <Text className="text-[12px] text-link font-semibold" numberOfLines={1}>
        {getStrongWordCaption(word)}
      </Text>
    </TouchableBox>
  )
}

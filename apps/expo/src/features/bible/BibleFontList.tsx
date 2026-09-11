import { useDispatch, useSelector } from 'react-redux'
import { Platform, ScrollView } from 'react-native'
import { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import fonts from '~helpers/fonts'
import type { RootState } from '~redux/modules/reducer'
import { setFontFamily } from '~redux/modules/user'

const fontOptions = ['Literata Book', ...fonts]

export default function BibleFontList({ onSelect }: { onSelect?: () => void }) {
  const isWeb = Platform.OS === 'web'
  const dispatch = useDispatch()
  const selectedFont = useSelector((state: RootState) => state.user.fontFamily)

  return (
    <ScrollView style={{ maxHeight: 420 }}>
      {fontOptions.map(font => (
        <TouchableBox
          key={font}
          accessibilityRole="radio"
          accessibilityState={{ checked: font === selectedFont }}
          accessibilityLabel={font}
          className={
            isWeb
              ? 'w-full h-[44px] flex-row items-center gap-3 p-3 rounded-lg hover:bg-[#80808015]'
              : 'min-h-[56px] px-[20px] py-[12px] flex-row items-center border-b border-border'
          }
          onPress={() => {
            dispatch(setFontFamily(font))
            onSelect?.()
          }}
        >
          <Text
            className={font === selectedFont ? 'flex-1 text-primary' : 'flex-1 text-default'}
            style={{ fontFamily: font, fontSize: isWeb ? 14 : 18 }}
          >
            {font}
          </Text>
          {font === selectedFont && (
            <FeatherIcon name="check" size={isWeb ? 17 : 20} color="primary" />
          )}
        </TouchableBox>
      ))}
    </ScrollView>
  )
}

import { Image } from 'expo-image'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import TabIcon from '~features/app-switcher/utils/getIconByTabType'
import { BibleTab, getDefaultBibleTab, getDefaultData, TabItem } from '../../../../state/tabs'
import { useDefaultBibleVersion } from '../../../../state/useDefaultBibleVersion'
import { useSelectBibleReference } from './SelectBibleReferenceModalProvider'
interface NewTabItemProps {
  type: TabItem['type']
  newAtom: PrimitiveAtom<TabItem>
  onPlanPress?: () => void
  title?: string
  description?: string
  hero?: boolean
  compact?: boolean
}

const useOpenTabByType = ({ type, newAtom, onPlanPress }: NewTabItemProps) => {
  const [tab, setTab] = useAtom(newAtom)
  const { openBibleReferenceModal } = useSelectBibleReference()
  const defaultVersion = useDefaultBibleVersion()

  const onBibleSelectDone = (data: BibleTab['data']['temp']) => {
    const getData = () => {
      const reference = `${data.selectedBook.Numero}-${data.selectedChapter}-${data.selectedVerse}`

      if (type === 'compare') {
        return {
          selectedVerses: { [reference]: true },
        }
      }
      if (type === 'commentary') {
        return {
          verse: reference,
        }
      }

      return { ...getDefaultBibleTab(defaultVersion).data, ...data }
    }
    setTab({
      ...tab,
      type,
      data: getData(),
    } as TabItem)
  }

  const onPress = () => {
    if (type === 'plan') {
      onPlanPress?.()
      return
    }

    // Bible: ouvrir directement avec les données par défaut
    if (type === 'bible') {
      setTab({
        ...getDefaultBibleTab(defaultVersion),
        id: tab.id,
      })
      return
    }

    // Only comparison needs an initial passage selection.
    if (type === 'compare') {
      openBibleReferenceModal({
        onSelect: onBibleSelectDone,
      })
      return
    }

    setTab({ ...tab, base64Preview: '', type, ...getDefaultData(type) } as TabItem)
  }

  return {
    onPress,
  }
}

const NewTabItem = ({
  type,
  newAtom,
  onPlanPress,
  title,
  description,
  hero = false,
  compact = false,
}: NewTabItemProps) => {
  const { t } = useTranslation()
  const { onPress } = useOpenTabByType({ type, newAtom, onPlanPress })
  const isLibraryResource =
    type === 'strong' || type === 'nave' || type === 'dictionary' || type === 'commentary'
  const iconSize = hero ? 64 : isLibraryResource ? 34 : 28

  return (
    <TouchableBox
      testID={`new-tab-tool-${type}`}
      accessibilityLabel={title ?? t(`tabs.${type}`)}
      accessibilityHint={description}
      activeOpacity={0.7}
      className={
        hero
          ? 'relative overflow-hidden border-continuous flex-row items-center bg-light-primary rounded-[18px] px-[24px] py-[24px]'
          : 'border-continuous flex-row items-center bg-reverse border border-border rounded-[12px] px-[18px] py-[18px] min-h-[92px] gap-[14px]'
      }
      style={hero ? { minHeight: compact ? 180 : 218 } : undefined}
      onPress={onPress}
    >
      <Box
        className={
          hero
            ? 'flex-1 flex-row items-center gap-[24px] z-10'
            : 'flex-row items-center flex-1 gap-[14px]'
        }
        style={hero ? { paddingRight: compact ? 82 : 270 } : undefined}
      >
        {(!hero || !compact) && <TabIcon type={type} size={iconSize} />}
        <Box className="flex-1 min-w-0 gap-[6px]">
          <Text className={hero ? 'text-[36px] font-medium' : 'text-[16px] font-medium'}>
            {title ?? t(`tabs.${type}`)}
          </Text>
          {description ? (
            <Text className="text-[13px] leading-[19px] text-tertiary">{description}</Text>
          ) : null}
        </Box>
      </Box>
      {hero && (
        <Image
          source={require('~assets/images/new-tab/bible-reader.webp')}
          accessible={false}
          pointerEvents="none"
          contentFit="contain"
          contentPosition="bottom"
          style={{
            position: 'absolute',
            right: compact ? 24 : 42,
            bottom: 0,
            width: compact ? 125 : 295,
            height: compact ? 108 : 205,
          }}
        />
      )}
      <FeatherIcon name="chevron-right" size={hero ? 22 : 18} color="tertiary" />
    </TouchableBox>
  )
}

export default NewTabItem

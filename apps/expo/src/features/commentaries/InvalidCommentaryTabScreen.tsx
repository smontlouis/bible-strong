import { useAtomValue, useSetAtom } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { cachedTabIdsAtom, tabsAtomsAtom, type TabItem } from '~state/tabs'
const InvalidCommentaryTabScreen = ({ tabAtom }: { tabAtom: PrimitiveAtom<TabItem> }) => {
  const { t } = useTranslation()
  const tab = useAtomValue(tabAtom)
  const cachedTabIds = useAtomValue(cachedTabIdsAtom)
  const dispatchTabs = useSetAtom(tabsAtomsAtom)
  const setCachedTabIds = useSetAtom(cachedTabIdsAtom)

  const closeTab = () => {
    setCachedTabIds(cachedTabIds.filter(id => id !== tab.id))
    dispatchTabs({ type: 'remove', atom: tabAtom })
  }

  return (
    <Box className="overflow-hidden border-continuous flex-[1] bg-light-grey">
      <Header background title={t('Commentaires')} />
      <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center px-[32px]">
        <FeatherIcon name="alert-circle" size={42} color="grey" />
        <Text className="mt-[18px] font-bold text-[20px] text-center">
          {t('commentaries.tabs.invalidTitle')}
        </Text>
        <Text className="mt-[8px] text-grey text-[15px] leading-[22px] text-center">
          {t('commentaries.tabs.invalidBody')}
        </Text>
        <TouchableBox
          className="overflow-hidden border-continuous mt-[24px] px-[20px] py-[13px] rounded-[22px] bg-primary"
          onPress={closeTab}
          accessibilityRole="button"
        >
          <Text className="text-[white] font-bold">{t('commentaries.tabs.close')}</Text>
        </TouchableBox>
      </Box>
    </Box>
  )
}

export default InvalidCommentaryTabScreen

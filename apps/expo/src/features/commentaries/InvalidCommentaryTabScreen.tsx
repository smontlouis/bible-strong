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
    <Box flex bg="lightGrey">
      <Header background title={t('Commentaires')} />
      <Box flex center px={32}>
        <FeatherIcon name="alert-circle" size={42} color="grey" />
        <Text mt={18} bold fontSize={20} textAlign="center">
          {t('commentaries.tabs.invalidTitle')}
        </Text>
        <Text mt={8} color="grey" fontSize={15} lineHeight={22} textAlign="center">
          {t('commentaries.tabs.invalidBody')}
        </Text>
        <TouchableBox
          mt={24}
          px={20}
          py={13}
          borderRadius={22}
          bg="primary"
          onPress={closeTab}
          accessibilityRole="button"
        >
          <Text color="white" bold>
            {t('commentaries.tabs.close')}
          </Text>
        </TouchableBox>
      </Box>
    </Box>
  )
}

export default InvalidCommentaryTabScreen

import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import Snackbar from '~common/SnackBar'
import { TabItem, tabsAtomsAtom } from '../../../state/tabs'
import { useSlideNewTab } from './useSlideNewTab'

export const useOpenInNewTab = () => {
  const navigation = useNavigation()
  const { t } = useTranslation()
  const dispatchTabs = useSetAtom(tabsAtomsAtom)
  const { triggerSlideNewTab } = useSlideNewTab()

  const openInNewTab = (
    data?: TabItem,
    params: { autoRedirect?: true } = {}
  ) => {
    const newTabId = `new-${Date.now()}`
    dispatchTabs({
      type: 'insert',
      value: {
        id: newTabId,
        title: t('tabs.new'),
        isRemovable: true,
        type: 'new',
        data: {},
        ...data,
      },
    })

    if (!params.autoRedirect) {
      Snackbar.show(t('tabs.created'), 'info', {
        confirmText: t('common.goTo'),
        onConfirm: () => {
          navigation.navigate('AppSwitcher')
          triggerSlideNewTab(newTabId)
        },
      })
    } else {
      triggerSlideNewTab(newTabId)
      navigation.navigate('AppSwitcher')
    }
  }

  return openInNewTab
}

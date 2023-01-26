import Snackbar from '~common/SnackBar'
import { useNavigation } from 'react-navigation-hooks'
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai/react'
import { TabItem, tabsAtomsAtom } from '../../../state/tabs'
import { useSlideNewTab } from './useSlideNewTab'
import { useTabsQuota } from '~helpers/usePremium'

export const useOpenInNewTab = () => {
  const navigation = useNavigation()
  const { t } = useTranslation()
  const dispatchTabs = useSetAtom(tabsAtomsAtom)
  const { triggerSlideNewTab } = useSlideNewTab()
  const checkTabsQuota = useTabsQuota()

  const openInNewTab = (
    data?: TabItem,
    params: { autoRedirect?: true } = {}
  ) => {
    checkTabsQuota(() => {
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
        Snackbar.show('Onglet créé', 'info', {
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
    })
  }

  return openInNewTab
}

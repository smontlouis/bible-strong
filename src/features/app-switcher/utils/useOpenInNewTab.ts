import Snackbar from '~common/SnackBar'
import { useNavigation } from 'react-navigation-hooks'
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai'
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
      Snackbar.show('Onglet créé', 'info', {
        confirmText: t('common.goTo'),
        onConfirm: () => {
          triggerSlideNewTab(newTabId)
          navigation.navigate('AppSwitcher')
        },
      })
    }
  }

  return openInNewTab
}

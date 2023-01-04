import Snackbar from '~common/SnackBar'
import { useNavigation } from 'react-navigation-hooks'
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai'
import { TabItem, tabsAtomsAtom } from '../../../state/tabs'

export const useOpenInNewTab = () => {
  const navigation = useNavigation()
  const { t } = useTranslation()
  const dispatchTabs = useSetAtom(tabsAtomsAtom)

  const openInNewTab = (
    data?: TabItem,
    params: { autoRedirect?: true } = {}
  ) => {
    dispatchTabs({
      type: 'insert',
      value: {
        id: `new-${Date.now()}`,
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
        },
      })
    }
  }

  return openInNewTab
}

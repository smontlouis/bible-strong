import { useRouter } from 'expo-router'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner-native'
import generateUUID from '~helpers/generateUUID'
import { TabItem, tabsAtomsAtom } from '../../../state/tabs'
import { useSlideNewTab } from './useSlideNewTab'

export const useOpenInNewTab = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const dispatchTabs = useSetAtom(tabsAtomsAtom)
  const { triggerSlideNewTab } = useSlideNewTab()

  const openInNewTab = (data?: TabItem, params: { autoRedirect?: true } = {}) => {
    const newTabId = `new-${generateUUID()}`
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
      toast(t('tabs.created'), {
        action: {
          label: t('common.goTo'),
          onClick: () => {
            router.dismissTo('/')
            triggerSlideNewTab(newTabId)
            toast.dismiss()
          },
        },
      })
    } else {
      triggerSlideNewTab(newTabId)
      router.dismissTo('/')
    }
  }

  return openInNewTab
}

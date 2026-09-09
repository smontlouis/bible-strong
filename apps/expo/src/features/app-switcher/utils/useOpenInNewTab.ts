import { useWorkspaceRoutePanel } from '~navigation/useWorkspaceRoutePanel'
import { useRouter } from 'expo-router'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { toast } from '~helpers/toast'
import generateUUID from '~helpers/generateUUID'
import { TabItem, DEFAULT_GROUP_ID } from '../../../state/tabs'
import { addTabToGroupAtom, useSwitchGroup } from '~state/tabGroups'
import { useSlideNewTab } from './useSlideNewTab'

export const useOpenInNewTab = () => {
  const router = useRouter()
  const { open: isPanelOpen } = useWorkspaceRoutePanel()
  const { t } = useTranslation()
  const addTab = useSetAtom(addTabToGroupAtom)
  const switchGroup = useSwitchGroup()
  const { triggerSlideNewTab } = useSlideNewTab()

  const openInNewTab = (data?: TabItem, params: { autoRedirect?: true } = {}) => {
    const newTabId = `new-${generateUUID()}`
    const tab: TabItem = {
      id: newTabId,
      title: t('tabs.new'),
      isRemovable: true,
      type: 'new',
      data: {},
      ...data,
    }
    addTab({ groupId: DEFAULT_GROUP_ID, tab })
    const goToTab = () => {
      switchGroup(DEFAULT_GROUP_ID)
      router.dismissTo('/')
      triggerSlideNewTab(tab.id)
    }

    if (!params.autoRedirect && !isPanelOpen) {
      toast(t('tabs.created'), {
        action: {
          label: t('common.goTo'),
          onClick: () => {
            goToTab()
            toast.dismiss()
          },
        },
      })
    } else {
      goToTab()
    }
  }

  return openInNewTab
}

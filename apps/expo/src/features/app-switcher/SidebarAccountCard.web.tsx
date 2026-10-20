import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ContextualPanel from '~common/ContextualPanel'
import type { PanelScreen } from '~common/ContextualPanel/types'
import PanelAction from '~common/ContextualPanel/PanelAction'
import { type PersonalContent, personalContentIcons } from '~common/personalContent'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import Border from '~common/ui/Border'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import UserAvatar from '~common/ui/UserAvatar'
import { toast } from '~helpers/toast'
import useLogin from '~helpers/useLogin'
import { routeMapping } from '~navigation/routeMapping'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { resolveUniverseColors } from '~themes/universeColors'
import { useTheme } from '~themes/ThemeProvider'
import { WORKSPACE_SIDEBAR_WIDTH } from './utils/useResponsiveWorkspace'

const personalResources = [
  { route: 'Highlights', label: 'Surbrillances', content: 'highlights' },
  { route: 'Bookmarks', label: 'Marque-pages', content: 'bookmarks' },
  { route: 'BibleVerseNotes', label: 'Notes', content: 'notes' },
  { route: 'Studies', label: 'Études', content: 'study' },
  { route: 'BibleVerseLinks', label: 'Liens', content: 'links' },
  { route: 'Tags', label: 'Étiquettes', content: 'tags' },
] as const satisfies readonly {
  route: keyof typeof routeMapping
  label: string
  content: PersonalContent
}[]

export default function SidebarAccountCard({
  openSettings,
  onSelectContent,
}: {
  openSettings: () => void
  onSelectContent?: () => void
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<{ present: () => void; dismiss: () => void }>(null)
  const { t } = useTranslation()
  const { user, isLogged, logout } = useLogin()
  const theme = useTheme()
  const push = usePushRouteOnce()
  const confirm = useConfirmDialog()
  const name = isLogged
    ? user.displayName || user.email || t('settings.account')
    : t('workspace.guest')

  const openAccount = () => {
    push({ pathname: isLogged ? '/profile' : '/login' })
    onSelectContent?.()
  }
  const signOut = async () => {
    const confirmed = await confirm({
      title: t('Attention'),
      message: t('Voulez-vous vraiment vous déconnecter ?'),
      cancelLabel: t('Non'),
      confirmLabel: t('Se déconnecter'),
      destructive: true,
    })
    if (!confirmed) return
    try {
      await logout()
    } catch {
      toast.error(t('workspace.logoutFailed'))
    }
  }
  const screens: Record<string, PanelScreen> = {
    resources: {
      title: t('workspace.myResources'),
      hideHeader: true,
      content: navigation => (
        <Box className="gap-[2px]">
          {personalResources.map(resource => {
            const color = resolveUniverseColors(theme.colors, resource.content)
            return (
              <TouchableBox
                key={resource.route}
                accessibilityRole="button"
                className="flex-row items-center gap-[10px] min-h-[42px] px-[8px] py-[5px] rounded-[8px] hover:bg-canvas"
                onPress={() => {
                  navigation.close()
                  if (resource.route === 'Studies' && !isLogged) {
                    toast.info(t('study.loginRequired'))
                    return
                  }
                  push({ pathname: routeMapping[resource.route] })
                  onSelectContent?.()
                }}
              >
                <Box
                  className="w-[28px] h-[28px] rounded-[8px] items-center justify-center"
                  style={{ backgroundColor: color.background }}
                >
                  <FeatherIcon
                    name={personalContentIcons[resource.content]}
                    size={16}
                    color={color.foreground}
                  />
                </Box>
                <Text className="flex-1 text-[13px]">{t(resource.label)}</Text>
                {resource.route === 'Studies' && !isLogged && (
                  <FeatherIcon name="lock" size={12} color="grey" />
                )}
              </TouchableBox>
            )
          })}
          <Border className="my-[5px] mx-[8px]" />
          <PanelAction
            label={isLogged ? t('workspace.profile') : t('Se connecter')}
            icon="user"
            onPress={() => {
              navigation.close()
              openAccount()
            }}
          />
          <PanelAction
            label={t('settings.settings')}
            icon="settings"
            onPress={() => {
              navigation.close()
              openSettings()
            }}
          />
          {isLogged && (
            <PanelAction
              label={t('Se déconnecter')}
              icon="log-out"
              destructive
              onPress={() => {
                navigation.close()
                void signOut()
              }}
            />
          )}
        </Box>
      ),
    },
  }

  return (
    <div ref={anchorRef}>
      {/* The card sits in the sidebar's flow: its edge is its contrast with the canvas. */}
      <Card testID="workspace-account-card" className="p-[8px]">
        <HStack className="items-center">
          <TouchableBox
            accessibilityRole="button"
            accessibilityLabel={isLogged ? t('workspace.profile') : t('Se connecter')}
            onPress={openAccount}
            className="flex-1 min-w-0 flex-row items-center gap-[9px] min-h-[44px] px-[4px] rounded-[8px] hover:bg-canvas"
          >
            <UserAvatar
              size={38}
              photoURL={user.photoURL}
              displayName={user.displayName}
              email={user.email}
            />
            <Text numberOfLines={1} className="flex-1 font-bold text-[13px]">
              {name}
            </Text>
          </TouchableBox>
          <TouchableBox
            accessibilityRole="button"
            accessibilityLabel={t('workspace.accountMenu')}
            onPress={() => menuRef.current?.present()}
            className="w-[40px] h-[40px] items-center justify-center rounded-[8px] hover:bg-canvas"
          >
            <FeatherIcon name="chevron-up" size={18} color="grey" />
          </TouchableBox>
        </HStack>
      </Card>
      <ContextualPanel
        accessibilityLabel={t('workspace.myResources')}
        anchorRef={anchorRef}
        controllerRef={menuRef}
        trigger={null}
        width={WORKSPACE_SIDEBAR_WIDTH - 42}
        initialScreen="resources"
        screens={screens}
      />
    </div>
  )
}

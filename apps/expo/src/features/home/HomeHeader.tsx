import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import UserAvatar from '~common/ui/UserAvatar'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import {
  useWorkspaceHeaderInset,
  WORKSPACE_SIDEBAR_BUTTON_HEIGHT,
} from '~features/app-switcher/workspaceHeaderInset'
import useLogin from '~helpers/useLogin'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import HomeSearch from './HomeSearch'

const AVATAR_SIZE = 44

/**
 * Date, greeting with the first name, and the avatar that opens the profile. The wide Web home
 * already shows the account in its sidebar, so the search takes the avatar's place and wraps
 * below the greeting when the column is narrow.
 */
const HomeHeader = () => {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const { isLogged, user } = useLogin()
  const isWide = useResponsiveWorkspace()
  // The home has no header bar: its greeting starts below the sidebar button.
  const sidebarButtonClearance = useWorkspaceHeaderInset() ? WORKSPACE_SIDEBAR_BUTTON_HEIGHT : 20
  const search = Platform.OS === 'web' && isWide
  const firstName = user.displayName?.trim().split(/\s+/)[0]
  const date = new Date().toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <Box
      className={`flex-row items-end justify-between gap-[12px] px-[20px] ${search ? 'flex-wrap' : ''}`}
      style={{ paddingTop: sidebarButtonClearance }}
    >
      <Box className="min-w-0" style={search ? { flexGrow: 1, flexBasis: 240 } : { flex: 1 }}>
        <Text className="text-[12px] leading-[16px] font-bold uppercase tracking-[1.5px] text-tertiary">
          {date}
        </Text>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          className="mt-[4px] text-[30px] leading-[38px]"
          style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
        >
          {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingAnonymous')}
        </Text>
      </Box>
      {search ? (
        <Box style={{ width: 340, maxWidth: '100%' }}>
          <HomeSearch />
        </Box>
      ) : (
        isLogged && (
          <Link route="Profile" accessibilityLabel={t('workspace.profile')} size={AVATAR_SIZE}>
            <UserAvatar
              size={AVATAR_SIZE}
              photoURL={user.photoURL}
              displayName={user.displayName}
              email={user.email}
            />
          </Link>
        )
      )}
    </Box>
  )
}

export default HomeHeader

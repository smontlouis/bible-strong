import { useTranslation } from 'react-i18next'
import { titleFontStyle } from '~themes/styleValues'
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
import { windowDragRegion } from '~features/app-switcher/windowChrome'
import useLogin from '~helpers/useLogin'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import MusicButton from '~features/bible-audio/ui/MusicButton'
import HomeSearch from './HomeSearch'

const AVATAR_SIZE = 44
// A drawn avatar is square: it sits inside the circle with room around it.
const DRAWN_AVATAR_SIZE = 28

/**
 * Date, greeting with the first name, the background music and the avatar that opens the profile.
 * The wide Web home already shows the account in its sidebar, so the search takes the avatar's
 * place and wraps below the greeting when the column is narrow.
 */
const HomeHeader = () => {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const { isLogged, user } = useLogin()
  const isWide = useResponsiveWorkspace()
  // The home has no header bar: its greeting starts below the sidebar button.
  const workspaceHeaderInset = useWorkspaceHeaderInset()
  const sidebarButtonClearance = workspaceHeaderInset ? WORKSPACE_SIDEBAR_BUTTON_HEIGHT : 20
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
      dataSet={windowDragRegion(workspaceHeaderInset)}
    >
      <Box className="min-w-0" style={search ? { flexGrow: 1, flexBasis: 240 } : { flex: 1 }}>
        <Text className="text-[12px] leading-[16px] font-medium uppercase tracking-[1.5px] text-grey">
          {date}
        </Text>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          className="mt-[4px] text-[30px] leading-[38px]"
          style={titleFontStyle(theme)}
        >
          {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingAnonymous')}
        </Text>
      </Box>
      {search ? (
        <Box
          className="flex-row items-center gap-[10px]"
          style={{ flexGrow: 1, flexBasis: 340, maxWidth: '100%' }}
        >
          <Box className="flex-[1] min-w-0">
            <HomeSearch />
          </Box>
          <MusicButton placement="bottom" />
        </Box>
      ) : (
        <Box className="flex-row items-center gap-[10px]">
          {/* The background music plays anywhere: the home is where a reader starts it. */}
          <MusicButton size={AVATAR_SIZE} placement="bottom" />
          {isLogged && (
            <Link route="Profile" accessibilityLabel={t('workspace.profile')} size={AVATAR_SIZE}>
              {/* A circle like the music's beside it: a photo fills it, a drawn avatar sits in it. */}
              <Box
                className="border-continuous items-center justify-center rounded-full overflow-hidden"
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  backgroundColor: colorWithOpacity(theme.colors.default, 0.06) ?? 'transparent',
                }}
              >
                <UserAvatar
                  size={user.photoURL ? AVATAR_SIZE : DRAWN_AVATAR_SIZE}
                  photoURL={user.photoURL}
                  displayName={user.displayName}
                  email={user.email}
                />
              </Box>
            </Link>
          )}
        </Box>
      )}
    </Box>
  )
}

export default HomeHeader

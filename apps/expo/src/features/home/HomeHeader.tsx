import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import UserAvatar from '~common/ui/UserAvatar'
import useLogin from '~helpers/useLogin'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'

const AVATAR_SIZE = 44

/** Date, greeting with the first name, and the avatar that opens the profile. */
const HomeHeader = () => {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const { isLogged, user } = useLogin()
  const firstName = user.displayName?.trim().split(/\s+/)[0]
  const date = new Date().toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <Box className="flex-row items-end justify-between gap-[12px] px-[20px] pt-[20px]">
      <Box className="flex-1 min-w-0">
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
      {isLogged && (
        <Link route="Profile" accessibilityLabel={t('workspace.profile')} size={AVATAR_SIZE}>
          <UserAvatar
            size={AVATAR_SIZE}
            photoURL={user.photoURL}
            displayName={user.displayName}
            email={user.email}
          />
        </Link>
      )}
    </Box>
  )
}

export default HomeHeader

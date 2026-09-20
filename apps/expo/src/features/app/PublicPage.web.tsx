import type { ReactNode } from 'react'
import { Image } from 'expo-image'
import { Linking } from 'react-native'

import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import PageContent from '~common/ui/PageContent'
import { usePublicShell } from '~navigation/PublicShellContext'

const PublicPage = ({
  title,
  children,
  onOpenApp,
}: {
  title: string
  children: ReactNode
  onOpenApp?: () => void
}) => {
  const publicShell = usePublicShell()
  if (!publicShell.active) return children

  return (
    <Box className="flex-1 min-h-0 bg-reverse">
      <Box className="h-[56px] shrink-0 border-b border-border bg-reverse">
        <PageContent className="h-[56px] flex-row items-center px-[18px]">
          <TouchableBox
            className="flex-1 flex-row items-center min-w-0"
            accessibilityRole="link"
            accessibilityLabel="Bible Strong"
            onPress={() => void Linking.openURL('https://bible-strong.app')}
          >
            <Image
              source={require('~assets/images/icon.png')}
              style={{ width: 26, height: 26, borderRadius: 13 }}
              accessible={false}
            />
            <Text className="ml-[10px] font-bold text-[15px]" numberOfLines={1}>
              Bible Strong
            </Text>
          </TouchableBox>
          <Text
            className="flex-[1.4] px-[12px] text-center font-bold text-[14px]"
            numberOfLines={1}
          >
            {title}
          </Text>
          <Box className="flex-1 items-end min-w-0">
            <TouchableBox
              className="h-[36px] items-center justify-center rounded-full bg-primary px-[14px]"
              accessibilityRole="button"
              accessibilityLabel="Ouvrir l’app"
              onPress={onOpenApp ?? publicShell.openWorkspace}
            >
              <Text className="text-[13px] font-bold text-reverse">Ouvrir l’app</Text>
            </TouchableBox>
          </Box>
        </PageContent>
      </Box>
      <Box className="flex-1 min-h-0">{children}</Box>
    </Box>
  )
}

export default PublicPage
